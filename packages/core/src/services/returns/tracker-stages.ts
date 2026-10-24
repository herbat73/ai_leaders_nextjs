import type { StoredReturnStatus } from "./types";

/** The five customer-facing stages, in order. The page maps each id to Polish copy. */
export const TRACKER_STAGE_IDS = [
  "submitted",
  "approved",
  "in_transit",
  "received",
  "resolved",
] as const;
export type TrackerStageId = (typeof TRACKER_STAGE_IDS)[number];

export type TrackerStageState = "done" | "current" | "upcoming";

export interface TrackerStage {
  id: TrackerStageId;
  state: TrackerStageState;
}

export type TrackerClosedKind = "rejected" | "cancelled" | "unknown";
export type TrackerBanner = "awaiting_customer";

/** Ids for the "Co teraz?" line; the page owns the Polish text. */
export type WhatNowKey = `what_now_${StoredReturnStatus}`;

export interface TrackerView {
  /**
   * The five stages with their state. Empty when `closed` is set: a closed request replaces the stages
   * (spec K-05) and no stage is marked done, because the customer-facing reading is "this ended", not a partial journey.
   */
  stages: TrackerStage[];
  /** Set for `rejected`, `cancelled` and `unknown`. The reason text is the decision note, attached by the page. */
  closed?: { kind: TrackerClosedKind };
  /** A banner shown on the current stage. */
  banner?: TrackerBanner;
  whatNow: WhatNowKey;
  /** `true` only for `submitted`: show "Odpowiemy w ciągu 2 dni roboczych". */
  showReplyTarget: boolean;
}

/** The "Co teraz?" id for a status. */
export function whatNowKey(status: StoredReturnStatus): WhatNowKey {
  return `what_now_${status}`;
}

function stagesAt(
  current: TrackerStageId,
  currentState: TrackerStageState = "current",
): TrackerStage[] {
  const currentIndex = TRACKER_STAGE_IDS.indexOf(current);
  return TRACKER_STAGE_IDS.map((id, index) => ({
    id,
    state:
      index < currentIndex
        ? "done"
        : index === currentIndex
          ? currentState
          : "upcoming",
  }));
}

/**
 * Pure mapping from a stored status to the tracker view model. Language-neutral ids only.
 *
 * - `in_service` is shown under Received (current).
 * - `awaiting_customer` is a banner on the current stage. `transitions.ts` has no moves into or out of it yet, so
 *   the stage it interrupts is not recorded; the only state in which the agent can ask the customer something is
 *   before a decision, so it is modelled as `submitted` current with the banner.
 * - `rejected` and `cancelled` give a closed state and no stages; `unknown` (a corrupt row) gives a closed "unknown"
 *   state with no stage done.
 * - `resolved` marks every stage done: the journey is complete and nothing is current.
 */
export function trackerView(status: StoredReturnStatus): TrackerView {
  const whatNow = whatNowKey(status);
  const showReplyTarget = status === "submitted";
  switch (status) {
    case "submitted":
      return { stages: stagesAt("submitted"), whatNow, showReplyTarget };
    case "awaiting_customer":
      return {
        stages: stagesAt("submitted"),
        banner: "awaiting_customer",
        whatNow,
        showReplyTarget,
      };
    case "approved":
      return { stages: stagesAt("approved"), whatNow, showReplyTarget };
    case "in_transit":
      return { stages: stagesAt("in_transit"), whatNow, showReplyTarget };
    case "received":
    case "in_service":
      return { stages: stagesAt("received"), whatNow, showReplyTarget };
    case "resolved":
      return {
        stages: TRACKER_STAGE_IDS.map((id) => ({ id, state: "done" as const })),
        whatNow,
        showReplyTarget,
      };
    case "rejected":
    case "cancelled":
    case "unknown":
      return { stages: [], closed: { kind: status }, whatNow, showReplyTarget };
  }
}
