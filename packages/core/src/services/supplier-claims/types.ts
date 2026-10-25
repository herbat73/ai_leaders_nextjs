import type { Money } from "../../domain/money";

export const SUPPLIER_CLAIM_STATUSES = ["draft", "sent", "accepted", "rejected", "credited"] as const;
export type SupplierClaimStatus = (typeof SUPPLIER_CLAIM_STATUSES)[number];

/** A stored status that is not one of the five (hand edit, corruption); never workable. */
export type StoredSupplierClaimStatus = SupplierClaimStatus | "unknown";

/** One claim to a vendor for one complaint. The e-mail as composed is kept (`subject`, `body`) for audit. */
export interface SupplierClaim {
  id: number;
  /** `SC-YYYY-NNNNN`. */
  ref: string;
  returnRequestId: number;
  supplierId: number;
  status: StoredSupplierClaimStatus;
  subject: string;
  body: string;
  /** The agent who created it; the e-mail's Reply-To. */
  createdByAgentId: number;
  sentAt: Date | null;
  answeredAt: Date | null;
  /** Set when the vendor accepted. */
  creditAmount: Money | null;
  /** The vendor's reason (rejected) or remark (accepted). */
  answerNote: string | null;
  creditedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierClaimEvent {
  id: number;
  type: "created" | "status_changed";
  fromStatus: StoredSupplierClaimStatus | null;
  toStatus: StoredSupplierClaimStatus;
  note: string | null;
  agentId: number | null;
  agentName: string | null;
  createdAt: Date;
}

/** A claim with the vendor's name, for lists and the claim page. */
export interface SupplierClaimView extends SupplierClaim {
  supplierName: string;
  supplierEmail: string;
  /** The complaint it belongs to. */
  rma: string;
  allowedTransitions: SupplierClaimStatus[];
}

export interface SupplierClaimDetail {
  claim: SupplierClaimView;
  events: SupplierClaimEvent[];
}

export interface NewSupplierClaim {
  returnRequestId: number;
  supplierId: number;
  subject: string;
  body: string;
  agentId: number;
}

/** What the vendor answered, recorded with the move to `accepted`, `rejected` or `credited`. */
export interface SupplierClaimAnswer {
  note: string | null;
  creditAmount?: Money;
}

export type SupplierClaimTransitionOutcome =
  | { result: "moved"; claim: SupplierClaim }
  | { result: "conflict"; currentStatus: StoredSupplierClaimStatus }
  | { result: "not_found" };

/** Port implemented by `@easyrms/db`. */
export interface SupplierClaimRepository {
  /**
   * Assigns the reference from a sequence and writes the `draft` claim and its `created` event in one transaction. A
   * second claim for the same complaint surfaces as a 409 `claim_exists` `AppError`.
   */
  create(input: NewSupplierClaim): Promise<SupplierClaim>;
  findById(id: number): Promise<SupplierClaim | null>;
  findByReturnRequest(returnRequestId: number): Promise<SupplierClaim | null>;
  /** Newest first; with the vendor's name and the complaint's RMA. */
  list(filter?: { status?: StoredSupplierClaimStatus }): Promise<Omit<SupplierClaimView, "allowedTransitions">[]>;
  findDetail(id: number): Promise<{ claim: Omit<SupplierClaimView, "allowedTransitions">; events: SupplierClaimEvent[] } | null>;
  /**
   * Atomic compare-and-set from `from` to `to`, writing one event with the acting agent. `draft → sent` sets `sentAt`;
   * `accepted`/`rejected` set `answeredAt`, the note and (accepted) the credit amount; `credited` sets `creditedAt`.
   */
  transition(
    id: number,
    from: SupplierClaimStatus,
    to: SupplierClaimStatus,
    agentId: number,
    answer?: SupplierClaimAnswer,
  ): Promise<SupplierClaimTransitionOutcome>;
}
