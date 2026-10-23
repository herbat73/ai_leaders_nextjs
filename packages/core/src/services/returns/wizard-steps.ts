import { MAX_EXCHANGE_NOTE_LENGTH, MAX_ITEM_COMMENT_LENGTH } from "../../validators/returns/return-submit.schema";
import type { ReturnMethod, ReturnReasonCode, ReturnResolution } from "./types";

export const WIZARD_STEPS = ["items", "reasons", "method", "resolution", "summary"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

/** One order line as the wizard sees it (cap = remaining quantity). */
export interface WizardLine {
  lineRef: string;
  remainingQuantity: number;
  eligible: boolean;
}

export interface WizardItemState {
  lineRef: string;
  quantity: number;
  reasonCode: ReturnReasonCode | null;
  comment: string;
}

export interface WizardState {
  items: WizardItemState[];
  returnMethod: ReturnMethod | null;
  resolution: ReturnResolution | null;
  exchangeNote: string;
  acknowledged: boolean;
}

export type WizardProblem =
  | "no_items"
  | "quantity"
  | "ineligible"
  | "reason_missing"
  | "comment_too_long"
  | "method_missing"
  | "resolution_missing"
  | "exchange_note_missing"
  | "exchange_note_too_long"
  | "acknowledgement_missing";

export interface StepCheck {
  ok: boolean;
  /** Problems of the step; `lineRef` is set for per-item problems. */
  problems: { problem: WizardProblem; lineRef?: string }[];
}

/** Pure validity of one step (the server re-validates everything; this only gates "Next"). */
export function checkWizardStep(step: WizardStep, state: WizardState, lines: readonly WizardLine[]): StepCheck {
  const problems: StepCheck["problems"] = [];
  const byRef = new Map(lines.map((line) => [line.lineRef, line]));
  if (step === "items") {
    if (state.items.length === 0) problems.push({ problem: "no_items" });
    for (const item of state.items) {
      const line = byRef.get(item.lineRef);
      if (!line || !line.eligible) problems.push({ problem: "ineligible", lineRef: item.lineRef });
      else if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > line.remainingQuantity) {
        problems.push({ problem: "quantity", lineRef: item.lineRef });
      }
    }
  } else if (step === "reasons") {
    for (const item of state.items) {
      if (item.reasonCode === null) problems.push({ problem: "reason_missing", lineRef: item.lineRef });
      if (item.comment.trim().length > MAX_ITEM_COMMENT_LENGTH) problems.push({ problem: "comment_too_long", lineRef: item.lineRef });
    }
  } else if (step === "method") {
    if (state.returnMethod === null) problems.push({ problem: "method_missing" });
  } else if (step === "resolution") {
    if (state.resolution === null) problems.push({ problem: "resolution_missing" });
    else if (state.resolution === "exchange") {
      const note = state.exchangeNote.trim();
      if (note.length === 0) problems.push({ problem: "exchange_note_missing" });
      else if (note.length > MAX_EXCHANGE_NOTE_LENGTH) problems.push({ problem: "exchange_note_too_long" });
    }
  } else if (!state.acknowledged) {
    problems.push({ problem: "acknowledgement_missing" });
  }
  return { ok: problems.length === 0, problems };
}

/** First step (in order) that is not valid, or `null` when the whole wizard is valid. */
export function firstInvalidStep(state: WizardState, lines: readonly WizardLine[]): WizardStep | null {
  return WIZARD_STEPS.find((step) => !checkWizardStep(step, state, lines).ok) ?? null;
}
