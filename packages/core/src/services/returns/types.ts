import type { Money } from "../../domain/money";

export const RETURN_STATUSES = [
  "submitted",
  "awaiting_customer",
  "approved",
  "in_transit",
  "received",
  "in_service",
  "resolved",
  "rejected",
  "cancelled",
] as const;

export type ReturnStatus = (typeof RETURN_STATUSES)[number];

/** A stored status that is not one of the nine (hand edit, corruption); never workable. */
export type StoredReturnStatus = ReturnStatus | "unknown";

export const RETURN_KIND = "return";
export const COMPLAINT_KIND = "complaint";
export const REQUEST_KINDS = [RETURN_KIND, COMPLAINT_KIND] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const RETURN_RESOLUTIONS = ["refund", "store_credit", "exchange"] as const;
export type ReturnResolution = (typeof RETURN_RESOLUTIONS)[number];

/** Remedies of a complaint (R05): repair or replacement first, refund when neither is possible. */
export const COMPLAINT_RESOLUTIONS = ["repair", "replacement", "refund"] as const;
export type ComplaintResolution = (typeof COMPLAINT_RESOLUTIONS)[number];

/** Every resolution a stored request can carry. */
export type RequestResolution = ReturnResolution | ComplaintResolution;

export const RETURN_METHODS = ["parcel_locker", "courier", "store"] as const;
export type ReturnMethod = (typeof RETURN_METHODS)[number];

export const RETURN_REASON_CODES = ["size", "not_as_described", "changed_mind", "better_price", "mistake", "other"] as const;
export type ReturnReasonCode = (typeof RETURN_REASON_CODES)[number];

/** The single item reason of a complaint: the defect itself is described once on the request. */
export const COMPLAINT_REASON_CODE = "defective";
export type ItemReasonCode = ReturnReasonCode | typeof COMPLAINT_REASON_CODE;

/** One returned order line. Name and price are a snapshot; the order platform stays the source of truth. */
export interface ReturnItem {
  lineRef: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: Money;
  reasonCode: ItemReasonCode;
  comment: string | null;
  /** Complaints only; absent or `null` on returns and on hand-built values (tests). */
  serialNumber?: string | null;
}

export interface ReturnRequest {
  id: number;
  /** `RMA-YYYY-NNNNN`, the reference quoted to customers. */
  rma: string;
  kind: RequestKind;
  orderNumber: string;
  customerEmail: string;
  /** Free text of the legacy form; `null` for requests submitted through the customer portal (per-item reason codes). */
  reason: string | null;
  status: StoredReturnStatus;
  /** The note text itself is only read through `findDetail`. */
  hasDecisionNote: boolean;
  /** Set by the customer portal; `null` on legacy rows. Absent on hand-built values (tests). */
  resolution?: RequestResolution | null;
  /** `null` for `exchange` and legacy rows. */
  resolutionAmount?: Money | null;
  returnMethod?: ReturnMethod | null;
  exchangeNote?: string | null;
  /** Complaints only (absent on hand-built values): what is wrong, 20-2000 characters. */
  defectDescription?: string | null;
  /** Complaints only: `YYYY-MM-DD`, the day the customer noticed the defect. */
  defectDiscoveredOn?: string | null;
  /** Complaints only: `null` until the complaint is `received`, then the agent's finding. Gates the vendor claim. */
  defectConfirmed?: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A request as the inbox and the API show it: the request plus values derived from the clock and the state machine. */
export interface ReturnListItem extends ReturnRequest {
  /** Returns: the internal 2-business-day reply target. Complaints: the statutory answer day (14 calendar days, R04). */
  dueAt: Date;
  overdue: boolean;
  allowedTransitions: ReturnStatus[];
  /** Complaints only: still unanswered from the escalation day on (Q07). */
  escalated?: boolean;
  /** Complaints only: calendar days to `dueAt` while unanswered (negative once passed); `null` once answered. */
  daysLeft?: number | null;
}

export type ReturnEventActor = "customer" | "agent" | "system";

export interface ReturnEvent {
  id: number;
  type: "submitted" | "status_changed";
  fromStatus: StoredReturnStatus | null;
  toStatus: StoredReturnStatus;
  note: string | null;
  actor: ReturnEventActor;
  /** The signed-in agent behind an `agent` event; `null` on legacy, customer and system events. Admin reads only. */
  agentId?: number | null;
  /** Display name of that agent, filled by `findDetail` (the admin timeline) and never by `findByRma` (customer). */
  agentName?: string | null;
  createdAt: Date;
}

/** What the repository returns for one request: the only read that includes the decision note. */
export interface ReturnDetail {
  request: ReturnRequest;
  decisionNote: string | null;
  items: ReturnItem[];
  events: ReturnEvent[];
}

/** What the decision card shows: the detail with the derived list values on the request. */
export interface ReturnDetailView {
  request: ReturnListItem;
  decisionNote: string | null;
  items: ReturnItem[];
  events: ReturnEvent[];
}

export interface NewReturnItem {
  lineRef: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: Money;
  reasonCode: ItemReasonCode;
  comment?: string;
  serialNumber?: string;
}

/** A customer-portal submission, already validated and priced by the service. */
export interface NewReturnRequest {
  /** The canonical order number as returned by the order port (S8). */
  orderNumber: string;
  customerEmail: string;
  items: NewReturnItem[];
  /** Defaults to `return` when absent. */
  kind?: RequestKind;
  resolution: RequestResolution;
  /** `null` for `exchange`, `repair` and `replacement`. */
  resolutionAmount: Money | null;
  exchangeNote?: string;
  returnMethod: ReturnMethod;
  idempotencyKey: string;
  /** Complaints only. */
  defectDescription?: string;
  defectDiscoveredOn?: string;
}

export interface ReturnListFilter {
  status?: StoredReturnStatus;
  kind?: RequestKind;
}

export type TransitionOutcome =
  | { result: "moved"; request: ReturnRequest }
  | { result: "conflict"; currentStatus: StoredReturnStatus }
  | { result: "not_found" };

/** Port implemented by `@easyrms/db`. */
export interface ReturnRepository {
  list(filter?: ReturnListFilter): Promise<ReturnRequest[]>;
  findDetail(id: number): Promise<ReturnDetail | null>;
  /** Status only, so the service can validate a move without reading the decision note. */
  findStatus(id: number): Promise<StoredReturnStatus | null>;
  /** The request without its decision note (resolution and amount included), for the approval-limit check. */
  findRequest(id: number): Promise<ReturnRequest | null>;
  /**
   * Assigns the RMA and writes the row, its items and the `submitted` event in one transaction (joins the caller's).
   * A duplicate `idempotencyKey` surfaces as `ConflictError` (409 `conflict`), never as an unmapped error.
   */
  createWithItems(input: NewReturnRequest): Promise<ReturnRequest>;
  /** Newest first. */
  listByOrder(orderNumber: string): Promise<ReturnRequest[]>;
  /** With items and events, like `findDetail`. */
  findByRma(rma: string): Promise<ReturnDetail | null>;
  findByIdempotencyKey(key: string): Promise<ReturnRequest | null>;
  /**
   * Quantity per `lineRef` held by the order's requests whose status is not `cancelled` or `rejected` (those release it).
   * An unreadable stored status counts as held.
   */
  claimedQuantities(orderNumber: string): Promise<Record<string, number>>;
  /**
   * Runs `fn` in one transaction holding a per-order advisory lock, so submits for one order are serialised. `tx` is a
   * repository bound to that transaction; throwing rolls everything back.
   */
  withOrderLock<T>(orderNumber: string, fn: (tx: ReturnRepository) => Promise<T>): Promise<T>;
  /**
   * Atomic compare-and-set from `from` to `to`, writing one event with the status change and the deciding agent.
   * `note` becomes the decision note only for `approved`/`rejected`; no other move touches it.
   */
  transition(
    id: number,
    from: ReturnStatus,
    to: ReturnStatus,
    note: string | null,
    agentId: number,
    /** Complaints only: written with the move to `received` (the agent's finding); other moves leave it untouched. */
    defectConfirmed?: boolean,
  ): Promise<TransitionOutcome>;
}
