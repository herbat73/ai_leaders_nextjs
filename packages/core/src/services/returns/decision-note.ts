import { DECISION_STATUSES } from "./transitions";
import type { ReturnStatus } from "./types";

export const REJECT_NOTE_MIN_LENGTH = 30;

export type DecisionNoteCheck = { ok: true; note: string | null } | { ok: false; message: string };

/**
 * The decision-note rules for a move to `status` (R15): only `approved` and `rejected` accept a note; `rejected`
 * requires at least 30 trimmed characters; the stored note is the trimmed value (empty approval note → none).
 */
export function checkDecisionNote(status: ReturnStatus, note: string | undefined): DecisionNoteCheck {
  const acceptsNote = (DECISION_STATUSES as readonly ReturnStatus[]).includes(status);
  if (note !== undefined && !acceptsNote) {
    return { ok: false, message: "A note is only allowed when approving or rejecting" };
  }
  const trimmed = note?.trim() ?? "";
  if (status === "rejected" && trimmed.length < REJECT_NOTE_MIN_LENGTH) {
    return { ok: false, message: `A rejection needs a reason of at least ${REJECT_NOTE_MIN_LENGTH} characters` };
  }
  return { ok: true, note: trimmed === "" ? null : trimmed };
}
