import { formatMoney } from "../../domain/money";
import { NotFoundError, ServiceUnavailableError, TooManyRequestsError, ValidationError } from "../../errors";
import { CUSTOMER_RATE_RULES, rateKeys, type RateLimiter } from "../../security/rate-limiter";
import type { OrderLookup, OrderLookupResult, ReturnOrder } from "../orders/order-lookup.port";
import { checkEligibility, type EligibilityConfig, type IneligibleReason, type OrderEligibility } from "./eligibility";
import type { GuestSessionService } from "./guest-session.service";
import { calculateQuote, toQuoteView, validateQuoteLines, type QuoteConfig, type ReturnQuoteView } from "./quote";
import type { ReturnMethod, ReturnRepository, ReturnResolution } from "./types";

/** One neutral message for a wrong order number and a wrong e-mail alike. */
export const LOOKUP_NOT_FOUND_MESSAGE = "We could not find an order matching these details";
export const ORDER_UNAVAILABLE_MESSAGE = "The order system is unavailable, try again shortly";

export interface LookupLineView {
  lineRef: string;
  name: string;
  quantity: number;
  remainingQuantity: number;
  unitPriceText: string;
  eligible: boolean;
  ineligibleReason?: IneligibleReason;
}

export interface ReturnLookupView {
  orderNumber: string;
  /** ISO instant; `null` while the order is not delivered. */
  deliveredAt: string | null;
  lines: LookupLineView[];
  /** Only for an undelivered order. */
  trackingUrl?: string | null;
}

export interface ReturnLookupOutcome {
  view: ReturnLookupView;
  /** The signed guest session; `null` unless the order is delivered (nothing to return yet, so no session). */
  sessionToken: string | null;
}

export interface ReturnQuoteRequest {
  /** Canonical order number from the verified session. */
  sessionOrderNumber: string;
  items: { lineRef: string; quantity: number }[];
  returnMethod: ReturnMethod;
  resolution: ReturnResolution;
}

/**
 * Customer-side reads: order lookup (limiters, order port, eligibility, session) and quote. Only the canonical order
 * number from the port is used for claimed quantities and the session (S8).
 */
export class ReturnLookupService {
  private readonly returnRepository: ReturnRepository;
  private readonly orderLookup: OrderLookup;
  private readonly rateLimiter: RateLimiter;
  private readonly guestSessionService: GuestSessionService;
  private readonly clock: () => Date;
  private readonly eligibilityConfig: EligibilityConfig;
  private readonly quoteConfig: QuoteConfig;

  constructor(deps: {
    returnRepository: ReturnRepository;
    orderLookup: OrderLookup;
    rateLimiter: RateLimiter;
    guestSessionService: GuestSessionService;
    clock: () => Date;
    eligibilityConfig: EligibilityConfig;
    quoteConfig: QuoteConfig;
  }) {
    this.returnRepository = deps.returnRepository;
    this.orderLookup = deps.orderLookup;
    this.rateLimiter = deps.rateLimiter;
    this.guestSessionService = deps.guestSessionService;
    this.clock = deps.clock;
    this.eligibilityConfig = deps.eligibilityConfig;
    this.quoteConfig = deps.quoteConfig;
  }

  /**
   * Budgets: lookups per IP and failed attempts per (order, IP) are checked first (429). The order port then answers;
   * `unavailable` consumes nothing and is a 503, any other answer counts as one lookup and `not_found` also as one
   * failed attempt. A wrong order and a wrong e-mail are the same `not_found`.
   */
  async lookup(input: { orderNumber: string; email: string; ip: string }): Promise<ReturnLookupOutcome> {
    const lookupKey = rateKeys.lookup(input.ip);
    const failedKey = rateKeys.failedAttempt(input.orderNumber, input.ip);
    if (
      !this.rateLimiter.check(lookupKey, CUSTOMER_RATE_RULES.lookup).allowed ||
      !this.rateLimiter.check(failedKey, CUSTOMER_RATE_RULES.failedAttempt).allowed
    ) {
      throw new TooManyRequestsError();
    }

    const result = await this.orderLookup.lookup(input.orderNumber, input.email);
    if (result.status === "unavailable") throw new ServiceUnavailableError(ORDER_UNAVAILABLE_MESSAGE);
    this.rateLimiter.hit(lookupKey, CUSTOMER_RATE_RULES.lookup);
    if (result.status === "not_found") {
      this.rateLimiter.hit(failedKey, CUSTOMER_RATE_RULES.failedAttempt);
      throw new NotFoundError(LOOKUP_NOT_FOUND_MESSAGE);
    }

    const order = result.order;
    const claimed = await this.returnRepository.claimedQuantities(order.orderNumber);
    const eligibility = checkEligibility(order, this.clock(), this.eligibilityConfig, claimed);
    if (eligibility.status === "not_delivered") {
      return {
        view: { orderNumber: order.orderNumber, deliveredAt: null, lines: [], trackingUrl: eligibility.trackingUrl },
        sessionToken: null,
      };
    }
    const sessionToken = await this.guestSessionService.issue(order.orderNumber);
    return { view: this.toView(order, eligibility), sessionToken };
  }

  async quote(input: ReturnQuoteRequest): Promise<ReturnQuoteView> {
    const decision = this.rateLimiter.consume(rateKeys.quote(input.sessionOrderNumber), CUSTOMER_RATE_RULES.session);
    if (!decision.allowed) throw new TooManyRequestsError();

    const result: OrderLookupResult = await this.orderLookup.getByNumber(input.sessionOrderNumber);
    if (result.status === "unavailable") throw new ServiceUnavailableError(ORDER_UNAVAILABLE_MESSAGE);
    if (result.status === "not_found") throw new NotFoundError("Order not found");

    const order = result.order;
    const claimed = await this.returnRepository.claimedQuantities(order.orderNumber);
    const eligibility = checkEligibility(order, this.clock(), this.eligibilityConfig, claimed);
    const problems = validateQuoteLines(eligibility, input.items);
    const refs = Object.keys(problems);
    if (refs.length > 0) {
      const fields: Record<string, string> = {};
      for (const ref of refs) fields[`items.${ref}`] = problems[ref] as IneligibleReason;
      throw new ValidationError("Some items cannot be returned", fields);
    }
    const quote = calculateQuote(
      order,
      { lines: input.items, resolution: input.resolution, returnMethod: input.returnMethod },
      this.quoteConfig,
    );
    return toQuoteView(quote, this.quoteConfig.shippingFee.currency);
  }

  private toView(order: ReturnOrder, eligibility: Extract<OrderEligibility, { status: "delivered" }>): ReturnLookupView {
    const byRef = new Map(eligibility.lines.map((line) => [line.lineRef, line]));
    return {
      orderNumber: order.orderNumber,
      deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
      lines: order.lines.map((line): LookupLineView => {
        const state = byRef.get(line.lineRef);
        return {
          lineRef: line.lineRef,
          name: line.name,
          quantity: line.quantity,
          remainingQuantity: state?.remainingQuantity ?? 0,
          unitPriceText: formatMoney(line.unitPrice),
          eligible: state?.eligible ?? false,
          ...(state?.ineligibleReason ? { ineligibleReason: state.ineligibleReason } : {}),
        };
      }),
    };
  }
}
