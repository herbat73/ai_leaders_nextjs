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

export interface ReturnRequest {
  id: number;
  /** `RMA-YYYY-NNNNN`, the reference quoted to customers. */
  rma: string;
  kind: typeof RETURN_KIND;
  orderNumber: string;
  customerEmail: string;
  reason: string;
  status: StoredReturnStatus;
  /** The note text itself is only read through `findDetail`. */
  hasDecisionNote: boolean;
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
  createdAt: Date;
}

/** What the repository returns for one request: the only read that includes the decision note. */
export interface ReturnDetail {
  request: ReturnRequest;
  decisionNote: string | null;
  events: ReturnEvent[];
}

/** What the decision card shows: the detail with the derived list values on the request. */
export interface ReturnDetailView {
  request: ReturnListItem;
  decisionNote: string | null;
  events: ReturnEvent[];
}

export interface NewReturnRequest {
  orderNumber: string;
  customerEmail: string;
  reason: string;
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
  /** Assigns the RMA and writes the `submitted` event with the row. */
  create(input: NewReturnRequest): Promise<ReturnRequest>;
  /**
   * Atomic compare-and-set from `from` to `to`, writing one event with the status change. `note` becomes the decision
   * note only for `approved`/`rejected`; no other move touches it.
   */
  transition(id: number, from: ReturnStatus, to: ReturnStatus, note: string | null): Promise<TransitionOutcome>;
}
