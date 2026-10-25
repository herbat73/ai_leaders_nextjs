import { AppError, ConflictError, NotFoundError, ValidationError } from "../../errors";
import { compareMoney } from "../../domain/money";
import type { ApiLogger } from "../../http/types";
import type { SupplierClaimAnswerInput, SupplierClaimCreateInput } from "../../validators/supplier-claims/supplier-claim.schema";
import type { AgentContext } from "../agents/types";
import { maskEmail, type MailPort } from "../mail/mail.port";
import { COMPLAINT_KIND, type ReturnRepository } from "../returns/types";
import type { SupplierRepository } from "../suppliers/types";
import { claimedValue, composeSupplierClaim } from "./compose";
import { supplierClaimStateMachine } from "./transitions";
import {
  SUPPLIER_CLAIM_STATUSES,
  type StoredSupplierClaimStatus,
  type SupplierClaim,
  type SupplierClaimDetail,
  type SupplierClaimRepository,
  type SupplierClaimStatus,
  type SupplierClaimView,
} from "./types";

/** How the e-mail went: `sent` moved the claim to `sent`; the others leave it a `draft` the agent can retry. */
export type ClaimDelivery = "sent" | "not_configured" | "failed";

export interface ClaimCreateResult {
  claim: SupplierClaim;
  delivery: ClaimDelivery;
}

type Sender = Pick<AgentContext, "id" | "email" | "displayName">;

function withTransitions<T extends { status: StoredSupplierClaimStatus }>(claim: T): T & { allowedTransitions: SupplierClaimStatus[] } {
  return { ...claim, allowedTransitions: [...supplierClaimStateMachine.allowed(claim.status)] };
}

export class SupplierClaimService {
  private readonly supplierClaimRepository: SupplierClaimRepository;
  private readonly supplierRepository: SupplierRepository;
  private readonly returnRepository: ReturnRepository;
  private readonly mailPort: MailPort;
  private readonly logger: ApiLogger;

  constructor(deps: {
    supplierClaimRepository: SupplierClaimRepository;
    supplierRepository: SupplierRepository;
    returnRepository: ReturnRepository;
    mailPort: MailPort;
    logger: ApiLogger;
  }) {
    this.supplierClaimRepository = deps.supplierClaimRepository;
    this.supplierRepository = deps.supplierRepository;
    this.returnRepository = deps.returnRepository;
    this.mailPort = deps.mailPort;
    this.logger = deps.logger;
  }

  async list(filter?: { status?: StoredSupplierClaimStatus }): Promise<SupplierClaimView[]> {
    return (await this.supplierClaimRepository.list(filter)).map(withTransitions);
  }

  async getDetail(id: number): Promise<SupplierClaimDetail> {
    const detail = await this.supplierClaimRepository.findDetail(id);
    if (!detail) throw new NotFoundError(`Supplier claim ${id} not found`);
    return { claim: withTransitions(detail.claim), events: detail.events };
  }

  /** The claim of one complaint, if any (the decision card shows it). */
  async findForComplaint(returnId: number): Promise<SupplierClaimView | null> {
    const claim = await this.supplierClaimRepository.findByReturnRequest(returnId);
    return claim ? (await this.getDetail(claim.id)).claim : null;
  }

  /**
   * Creates the claim for a complaint whose defect was confirmed, then tries to send it. Checks in order: the complaint
   * exists (404) and is a complaint with a confirmed defect (400 `returnId`), the vendor exists and is active (400
   * `supplierId`), no claim exists yet (409 `claim_exists`). The claim is stored as `draft` first, so a mail failure
   * never loses it; `delivery` says what happened to the e-mail.
   */
  async create(input: SupplierClaimCreateInput, agent: Sender): Promise<ClaimCreateResult> {
    const detail = await this.returnRepository.findDetail(input.returnId);
    if (!detail) throw new NotFoundError(`Return ${input.returnId} not found`);
    const { request } = detail;
    if (request.kind !== COMPLAINT_KIND) throw new ValidationError("Only a complaint can be claimed", { returnId: "not_a_complaint" });
    if (request.defectConfirmed !== true) throw new ValidationError("The defect is not confirmed", { returnId: "defect_not_confirmed" });

    const supplier = await this.supplierRepository.findById(input.supplierId);
    if (!supplier) throw new ValidationError("Unknown supplier", { supplierId: "unknown" });
    if (!supplier.active) throw new ValidationError("This supplier is inactive", { supplierId: "inactive" });
    if (await this.supplierClaimRepository.findByReturnRequest(input.returnId)) {
      throw new AppError("A claim for this complaint already exists", 409, "claim_exists");
    }

    const { subject, body } = composeSupplierClaim({
      rma: request.rma,
      orderNumber: request.orderNumber,
      items: detail.items,
      defectDescription: request.defectDescription ?? "",
      defectDiscoveredOn: request.defectDiscoveredOn ?? null,
      supplierName: supplier.name,
      agentNote: input.agentNote,
      agent,
    });
    const claim = await this.supplierClaimRepository.create({
      returnRequestId: input.returnId,
      supplierId: supplier.id,
      subject,
      body,
      agentId: agent.id,
    });
    return this.trySend(claim, supplier.email, agent);
  }

  /** Retries a `draft`. 409 `mail_not_configured` when the transport does not deliver; the claim is untouched. */
  async send(id: number, agent: Sender): Promise<ClaimCreateResult> {
    const claim = await this.supplierClaimRepository.findById(id);
    if (!claim) throw new NotFoundError(`Supplier claim ${id} not found`);
    supplierClaimStateMachine.assert(claim.status, "sent");
    const supplier = await this.supplierRepository.findById(claim.supplierId);
    if (!supplier) throw new NotFoundError(`Supplier ${claim.supplierId} not found`);
    if (!this.mailPort.delivers) throw new AppError("Mail is not configured to deliver", 409, "mail_not_configured");
    const result = await this.trySend(claim, supplier.email, agent);
    if (result.delivery === "failed") throw new AppError("The e-mail could not be delivered, the claim stays a draft", 502, "mail_failed");
    return result;
  }

  private async trySend(claim: SupplierClaim, to: string, agent: Sender): Promise<ClaimCreateResult> {
    if (!this.mailPort.delivers) return { claim, delivery: "not_configured" };
    try {
      await this.mailPort.send({
        template: "supplier_claim",
        to,
        replyTo: agent.email,
        data: { subject: claim.subject, body: claim.body, ref: claim.ref },
      });
    } catch (error) {
      this.logger.error("mail send failed", { template: "supplier_claim", to: maskEmail(to), error: error instanceof Error ? error.name : "unknown" });
      return { claim, delivery: "failed" };
    }
    const outcome = await this.supplierClaimRepository.transition(claim.id, "draft", "sent", agent.id);
    if (outcome.result === "moved") return { claim: outcome.claim, delivery: "sent" };
    // Another agent sent it at the same moment: the claim is `sent` either way.
    return { claim, delivery: "sent" };
  }

  /**
   * Records the vendor's answer or the credit booking. Checks in order: the amount fits (400 `creditAmount`: above
   * zero is the schema's job, here not above the goods value of the complaint), existence (404), allowed move (409);
   * the repository's compare-and-set then settles two agents answering at once (409).
   */
  async recordAnswer(id: number, input: SupplierClaimAnswerInput, agent: Pick<AgentContext, "id">): Promise<SupplierClaim> {
    const claim = await this.supplierClaimRepository.findById(id);
    if (!claim) throw new NotFoundError(`Supplier claim ${id} not found`);
    supplierClaimStateMachine.assert(claim.status, input.status);
    const from = claim.status as SupplierClaimStatus;

    if (input.status === "accepted" && input.creditAmount) {
      const detail = await this.returnRepository.findDetail(claim.returnRequestId);
      if (detail && compareMoney(input.creditAmount, claimedValue(detail.items)) > 0) {
        throw new ValidationError("The credit is above the value of the claimed products", { creditAmount: "above_claim_value" });
      }
    }

    const outcome = await this.supplierClaimRepository.transition(id, from, input.status, agent.id, {
      note: input.note,
      ...(input.creditAmount ? { creditAmount: input.creditAmount } : {}),
    });
    switch (outcome.result) {
      case "moved":
        return outcome.claim;
      case "conflict":
        throw new ConflictError(`Supplier claim ${id} is now ${outcome.currentStatus}`, { status: outcome.currentStatus });
      case "not_found":
        throw new NotFoundError(`Supplier claim ${id} not found`);
    }
  }
}

export function isSupplierClaimStatus(value: unknown): value is SupplierClaimStatus {
  return (SUPPLIER_CLAIM_STATUSES as readonly unknown[]).includes(value);
}
