import type { ReturnEvent, ReturnEventActor, StoredReturnStatus } from "./types";

/** Id of the customer-facing text of one timeline event; the page owns the Polish text. */
export type TrackerEventKey = "event_submitted" | `event_${StoredReturnStatus}`;

/** Customer-facing view of an event: no agent identity, and a note only when it is a decision note (S4). */
export interface TrackerEventView {
  id: number;
  key: TrackerEventKey;
  /** Who acted, reduced to what the customer may see: themselves or the returns team. */
  actor: "customer" | "team";
  at: Date;
  note: string | null;
}

const DECISION_STATUSES: readonly StoredReturnStatus[] = ["approved", "rejected"];

function customerActor(actor: ReturnEventActor): "customer" | "team" {
  return actor === "customer" ? "customer" : "team";
}

/**
 * Maps a stored event to what the tracker may show. The note is kept only on the approve and reject events (the
 * decision note, customer-visible per S4); any other note is dropped so internal text can never reach the customer.
 */
export function trackerEventView(event: ReturnEvent): TrackerEventView {
  const isDecision = event.type === "status_changed" && DECISION_STATUSES.includes(event.toStatus);
  const note = isDecision ? (event.note?.trim() || null) : null;
  return {
    id: event.id,
    key: event.type === "submitted" ? "event_submitted" : `event_${event.toStatus}`,
    // The repository records the portal submit as a system event; to the customer it is their own action.
    actor: event.type === "submitted" ? "customer" : customerActor(event.actor),
    at: event.createdAt,
    note,
  };
}
