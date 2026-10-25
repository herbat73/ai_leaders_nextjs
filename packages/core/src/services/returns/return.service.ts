import { dueAt, overdue } from "../../calendar";
import { formatMoney, type Money } from "../../domain/money";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  TooManyRequestsError,
  ValidationError,
} from "../../errors";
import type { ApiLogger } from "../../http/types";
import { CUSTOMER_RATE_RULES, rateKeys, type RateLimiter } from "../../security/rate-limiter";
import type { ReturnSubmitBody } from "../../validators/returns/return-submit.schema";
import { hasPermission } from "../agents/permissions";
import type { AgentContext } from "../agents/types";
import { maskEmail, type MailPort, type MailTemplate } from "../mail/mail.port";
import type { OrderLookup, OrderLookupResult } from "../orders/order-lookup.port";
import { requiresManagerApproval, type ApprovalConfig } from "./approval";
import { checkDecisionNote } from "./decision-note";
import { checkEligibility, type EligibilityConfig, type IneligibleReason } from "./eligibility";
import { calculateQuote, validateQuoteLines, type QuoteConfig } from "./quote";
import { ORDER_UNAVAILABLE_MESSAGE } from "./return-lookup.service";
import { returnStateMachine } from "./transitions";
import {
  RETURN_STATUSES,
  type ReturnDetailView,
  type ReturnListFilter,
  type ReturnListItem,
  type ReturnRepository,
  type ReturnRequest,
  type RequestResolution,
  type ReturnStatus,
  type StoredReturnStatus,
} from "./types";

export function isReturnStatus(value: unknown): value is ReturnStatus {
  return (RETURN_STATUSES as readonly unknown[]).includes(value);
}

/** Maps a stored value to a known status, or `"unknown"` for anything else (never falls back to a workable status). */
export function toReturnStatus(value: unknown): StoredReturnStatus {
  return isReturnStatus(value) ? value : "unknown";
}

/**
 * The amount of a submitted request as the API shows it (same style as the quote view): minor units for arithmetic,
 * `text` formatted for display. `ReturnSubmitResult.resolutionAmount` is `null` for `exchange`.
 */
export interface ResolutionAmountView {
  amountMinor: number;
  currency: Money["currency"];
  text: string;
}

/** Body of `POST /api/returns`; the route answers 201 when `created` and 200 for an idempotent replay. */
export interface ReturnSubmitResult {
  created: boolean;
  rma: string;
  status: ReturnStatus | "unknown";
  resolution: RequestResolution | null;
  resolutionAmount: ResolutionAmountView | null;
}

function toAmountView(amount: Money | null | undefined): ResolutionAmountView | null {
  return amount ? { amountMinor: amount.amountMinor, currency: amount.currency, text: formatMoney(amount) } : null;
}

function fieldErrorsOf(problems: Record<string, IneligibleReason>): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [ref, reason] of Object.entries(problems)) fields[`items.${ref}`] = reason;
  return fields;
}

export class ReturnService {
  private readonly returnRepository: ReturnRepository;
  private readonly clock: () => Date;
  private readonly mailPort: MailPort;
  private readonly logger: ApiLogger;
  private readonly orderLookup: OrderLookup;
  private readonly rateLimiter: RateLimiter;
  private readonly eligibilityConfig: EligibilityConfig;
  private readonly quoteConfig: QuoteConfig;
  private readonly approvalConfig: ApprovalConfig;

  constructor(deps: {
    returnRepository: ReturnRepository;
    clock: () => Date;
    mailPort: MailPort;
    logger: ApiLogger;
    orderLookup: OrderLookup;
    rateLimiter: RateLimiter;
    eligibilityConfig: EligibilityConfig;
    quoteConfig: QuoteConfig;
    approvalConfig: ApprovalConfig;
  }) {
    this.returnRepository = deps.returnRepository;
    this.clock = deps.clock;
    this.mailPort = deps.mailPort;
    this.logger = deps.logger;
    this.orderLookup = deps.orderLookup;
    this.rateLimiter = deps.rateLimiter;
    this.eligibilityConfig = deps.eligibilityConfig;
    this.quoteConfig = deps.quoteConfig;
    this.approvalConfig = deps.approvalConfig;
  }

  async list(filter?: ReturnListFilter): Promise<ReturnListItem[]> {
    const now = this.clock();
    const rows = await this.returnRepository.list(filter);
    return rows.map((row) => this.toListItem(row, now));
  }

  async getDetail(id: number): Promise<ReturnDetailView> {
    const detail = await this.returnRepository.findDetail(id);
    if (!detail) throw new NotFoundError(`Return ${id} not found`);
    return { ...detail, request: this.toListItem(detail.request, this.clock()) };
  }

  /** The session order's requests, newest first. */
  async listForOrder(sessionOrder: string): Promise<ReturnListItem[]> {
    const now = this.clock();
    const rows = await this.returnRepository.listByOrder(sessionOrder);
    return rows.map((row) => this.toListItem(row, now));
  }

  /**
   * One request by RMA for the customer. A request of another order is a 404 with the same message as an unknown RMA,
   * so existence is never revealed. The detail still carries the agent's decision note; the tracker maps what it shows.
   */
  async getByRma(sessionOrder: string, rma: string): Promise<ReturnDetailView> {
    const detail = await this.returnRepository.findByRma(rma);
    if (!detail || detail.request.orderNumber !== sessionOrder) throw new NotFoundError("Return not found");
    return { ...detail, request: this.toListItem(detail.request, this.clock()) };
  }

  /**
   * Moves a request along the state machine on behalf of `agent`, who is recorded on the timeline event. Checks run in
   * the order the API documents: note rules (400), existence (404), allowed move (409), approval limit (403: approving a
   * refund above `refundApprovalLimit` needs `MANAGE_RULES`, R11); the repository's compare-and-set then settles a race
   * between two agents (409). Authentication (401) happened before the call.
   */
  async transition(
    id: number,
    status: ReturnStatus,
    decisionNote: string | undefined,
    agent: Pick<AgentContext, "id" | "permissions">,
  ): Promise<ReturnListItem> {
    const check = checkDecisionNote(status, decisionNote);
    if (!check.ok) throw new ValidationError("Invalid input", { decisionNote: check.message });

    const current = await this.returnRepository.findStatus(id);
    if (current === null) throw new NotFoundError(`Return ${id} not found`);
    returnStateMachine.assert(current, status);
    // `assert` only passes for a known status, so `current` is one of the nine here.
    const from = current as ReturnStatus;

    if (status === "approved") {
      const request = await this.returnRepository.findRequest(id);
      if (!request) throw new NotFoundError(`Return ${id} not found`);
      if (requiresManagerApproval(request, status, this.approvalConfig.refundApprovalLimit) && !hasPermission(agent, "MANAGE_RULES")) {
        throw new ForbiddenError("Approving a refund above the limit needs the MANAGE_RULES permission", "approval_required");
      }
    }

    const outcome = await this.returnRepository.transition(id, from, status, check.note, agent.id);
    switch (outcome.result) {
      case "moved":
        await this.notifyStatusChanged(outcome.request);
        return this.toListItem(outcome.request, this.clock());
      case "conflict":
        throw new ConflictError(`Return ${id} is now ${outcome.currentStatus}`, { status: outcome.currentStatus });
      case "not_found":
        throw new NotFoundError(`Return ${id} not found`);
    }
  }

  /**
   * Customer submit. Order of events: rate limit (429, budget shared with quote), order from the port before any lock
   * (503 `unavailable`, 404), a read-only replay shortcut, the eligibility check (400 with `items.<lineRef>` field
   * errors), then inside the per-order lock: idempotency lookup (replay returns the original; a key of another order
   * is 409), quantity re-check (409 when another request took the quantity meanwhile), insert with the server-computed
   * amount, and the customer e-mail taken from the order. The `return_submitted` mail goes out after the lock, for a
   * new request only.
   *
   * The replay shortcut runs before the eligibility check because a retry must not trip over its own consumed
   * quantity or a window that closed after the first attempt; the in-lock lookup still settles two racing retries.
   */
  async submit(sessionOrderNumber: string, input: ReturnSubmitBody): Promise<ReturnSubmitResult> {
    const sessionKey = rateKeys.quote(sessionOrderNumber);
    if (!this.rateLimiter.consume(sessionKey, CUSTOMER_RATE_RULES.session).allowed) throw new TooManyRequestsError();

    let lookedUp: OrderLookupResult;
    try {
      lookedUp = await this.orderLookup.getByNumber(sessionOrderNumber);
    } catch (error) {
      this.rateLimiter.release(sessionKey);
      throw error;
    }
    if (lookedUp.status === "unavailable") {
      // Reserved before the await; an unavailable platform does not spend session budget.
      this.rateLimiter.release(sessionKey);
      throw new ServiceUnavailableError(ORDER_UNAVAILABLE_MESSAGE);
    }
    if (lookedUp.status === "not_found") throw new NotFoundError("Order not found");
    const order = lookedUp.order;
    // Only the canonical number from the port is locked on, stored and compared (S8).
    const orderNumber = order.orderNumber;

    const earlier = await this.returnRepository.findByIdempotencyKey(input.idempotencyKey);
    if (earlier) return this.toSubmitResult(this.replayOf(earlier, orderNumber), false);

    const lines = input.items.map(({ lineRef, quantity }) => ({ lineRef, quantity }));
    const quoteInput = { lines, resolution: input.resolution, returnMethod: input.returnMethod };
    const claimedBefore = await this.returnRepository.claimedQuantities(orderNumber);
    const problems = validateQuoteLines(checkEligibility(order, this.clock(), this.eligibilityConfig, claimedBefore), lines);
    if (Object.keys(problems).length > 0) throw new ValidationError("Some items cannot be returned", fieldErrorsOf(problems));

    const outcome = await this.returnRepository.withOrderLock(orderNumber, async (tx) => {
      const existing = await tx.findByIdempotencyKey(input.idempotencyKey);
      if (existing) return { created: false, request: this.replayOf(existing, orderNumber) };

      const claimed = await tx.claimedQuantities(orderNumber);
      const recheck = validateQuoteLines(checkEligibility(order, this.clock(), this.eligibilityConfig, claimed), lines);
      const taken = Object.entries(recheck).filter(([, reason]) => reason === "already_claimed");
      if (taken.length > 0) {
        throw new ConflictError("Some items were claimed by another request", fieldErrorsOf(Object.fromEntries(taken)));
      }
      if (Object.keys(recheck).length > 0) throw new ValidationError("Some items cannot be returned", fieldErrorsOf(recheck));

      // Recomputed here: amounts sent by the client are never read (R12).
      const quote = calculateQuote(order, quoteInput, this.quoteConfig);
      const byRef = new Map(order.lines.map((line) => [line.lineRef, line]));
      const request = await tx.createWithItems({
        orderNumber,
        customerEmail: order.customerEmail,
        items: input.items.map((item) => {
          const line = byRef.get(item.lineRef);
          if (!line) throw new RangeError(`Unknown order line ${item.lineRef}`);
          return {
            lineRef: line.lineRef,
            sku: line.sku,
            name: line.name,
            quantity: item.quantity,
            unitPrice: line.unitPrice,
            reasonCode: item.reasonCode,
            ...(item.comment ? { comment: item.comment } : {}),
          };
        }),
        resolution: input.resolution,
        resolutionAmount: quote.amount,
        ...(input.resolution === "exchange" && input.exchangeNote ? { exchangeNote: input.exchangeNote } : {}),
        returnMethod: input.returnMethod,
        idempotencyKey: input.idempotencyKey,
      });
      return { created: true, request };
    });

    const { request, created } = outcome;
    if (created) {
      await this.notify("return_submitted", request.customerEmail, { rma: request.rma, resolution: request.resolution ?? null });
    }
    return this.toSubmitResult(request, created);
  }

  private replayOf(existing: ReturnRequest, orderNumber: string): ReturnRequest {
    if (existing.orderNumber !== orderNumber) {
      throw new ConflictError("This idempotency key was already used", { idempotencyKey: "already_used" });
    }
    return existing;
  }

  private notifyStatusChanged(request: ReturnRequest): Promise<void> {
    return this.notify("return_status_changed", request.customerEmail, { rma: request.rma, status: request.status });
  }

  /** Best effort: a failing mail port (throw or rejection) is logged without body and never fails the request. */
  private async notify(template: MailTemplate, to: string, data: Record<string, unknown>): Promise<void> {
    try {
      await this.mailPort.send({ template, to, data });
    } catch (error) {
      this.logger.error("mail send failed", {
        template,
        to: maskEmail(to),
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  private toSubmitResult(request: ReturnRequest, created: boolean): ReturnSubmitResult {
    return {
      created,
      rma: request.rma,
      status: request.status,
      resolution: request.resolution ?? null,
      resolutionAmount: toAmountView(request.resolutionAmount),
    };
  }

  private toListItem(request: ReturnRequest, now: Date): ReturnListItem {
    const due = dueAt(request.createdAt);
    return {
      ...request,
      dueAt: due,
      overdue: overdue(request.status, due, now),
      allowedTransitions: [...returnStateMachine.allowed(request.status)],
    };
  }
}
