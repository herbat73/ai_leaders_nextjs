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

export const RETURN_RESOLUTIONS = ["refund", "store_credit", "exchange"] as const;
export type ReturnResolution = (typeof RETURN_RESOLUTIONS)[number];

export const RETURN_METHODS = ["parcel_locker", "courier", "store"] as const;
export type ReturnMethod = (typeof RETURN_METHODS)[number];

export const RETURN_REASON_CODES = ["size", "not_as_described", "changed_mind", "better_price", "mistake", "other"] as const;
export type ReturnReasonCode = (typeof RETURN_REASON_CODES)[number];

/** One returned order line. Name and price are a snapshot; the order platform stays the source of truth. */
export interface ReturnItem {
  lineRef: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: Money;
  reasonCode: ReturnReasonCode;
  comment: string | null;
}

export interface ReturnRequest {
  id: number;
  /** `RMA-YYYY-NNNNN`, the reference quoted to customers. */
  rma: string;
  kind: typeof RETURN_KIND;
  orderNumber: string;
  customerEmail: string;
  /** Free text of the legacy form; `null` for requests submitted through the customer portal (per-item reason codes). */
  reason: string | null;
  status: StoredReturnStatus;
  /** The note text itself is only read through `findDetail`. */
  hasDecisionNote: boolean;
  /** Set by the customer portal; `null` on legacy rows. Absent on hand-built values (tests). */
  resolution?: ReturnResolution | null;
  /** `null` for `exchange` and legacy rows. */
  resolutionAmount?: Money | null;
  returnMethod?: ReturnMethod | null;
  exchangeNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A request as the inbox and the API show it: the request plus values derived from the clock and the state machine. */
export interface ReturnListItem extends ReturnRequest {
  dueAt: Date;
  overdue: boolean;
  allowedTransitions: ReturnStatus[];
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
  reasonCode: ReturnReasonCode;
  comment?: string;
}

/** A customer-portal submission, already validated and priced by the service. */
export interface NewReturnRequest {
  /** The canonical order number as returned by the order port (S8). */
  orderNumber: string;
  customerEmail: string;
  items: NewReturnItem[];
  resolution: ReturnResolution;
  /** `null` for `exchange`. */
  resolutionAmount: Money | null;
  exchangeNote?: string;
  returnMethod: ReturnMethod;
  idempotencyKey: string;
}

export interface ReturnListFilter {
  status?: StoredReturnStatus;
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
  transition(id: number, from: ReturnStatus, to: ReturnStatus, note: string | null, agentId: number): Promise<TransitionOutcome>;
}
