import {
  COMPLAINT_DESCRIPTION_MAX_LENGTH,
  COMPLAINT_DESCRIPTION_MIN_LENGTH,
  MAX_SERIAL_NUMBER_LENGTH,
} from "../../validators/returns/complaint-submit.schema";
import type { WizardLine } from "./wizard-steps";
import type { ComplaintResolution, ReturnMethod } from "./types";

export const COMPLAINT_WIZARD_STEPS = ["items", "defect", "method", "resolution", "summary"] as const;
export type ComplaintWizardStep = (typeof COMPLAINT_WIZARD_STEPS)[number];

export interface ComplaintWizardItemState {
  lineRef: string;
  quantity: number;
  serialNumber: string;
}

export interface ComplaintWizardState {
  items: ComplaintWizardItemState[];
  defectDescription: string;
  /** `YYYY-MM-DD` or empty. */
  defectDiscoveredOn: string;
  returnMethod: ReturnMethod | null;
  resolution: ComplaintResolution | null;
  acknowledged: boolean;
}

export type ComplaintWizardProblem =
  | "no_items"
  | "quantity"
  | "ineligible"
  | "description_too_short"
  | "description_too_long"
  | "date_missing"
  | "date_invalid"
  | "date_future"
  | "date_before_delivery"
  | "serial_too_long"
  | "method_missing"
  | "resolution_missing"
  | "acknowledgement_missing";

export interface ComplaintStepCheck {
  ok: boolean;
  problems: { problem: ComplaintWizardProblem; lineRef?: string }[];
}

/** Context the pure check needs from outside the form: today's Warsaw date and the delivery's, both `YYYY-MM-DD`. */
export interface ComplaintWizardContext {
  today: string;
  deliveredOn: string | null;
}

function isRealDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
}

/** Pure validity of one step (the server re-validates everything; this only gates "Next"). */
export function checkComplaintWizardStep(
  step: ComplaintWizardStep,
  state: ComplaintWizardState,
  lines: readonly WizardLine[],
  context: ComplaintWizardContext,
): ComplaintStepCheck {
  const problems: ComplaintStepCheck["problems"] = [];
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
  } else if (step === "defect") {
    const description = state.defectDescription.trim();
    if (description.length < COMPLAINT_DESCRIPTION_MIN_LENGTH) problems.push({ problem: "description_too_short" });
    else if (description.length > COMPLAINT_DESCRIPTION_MAX_LENGTH) problems.push({ problem: "description_too_long" });
    const date = state.defectDiscoveredOn;
    if (date === "") problems.push({ problem: "date_missing" });
    else if (!isRealDate(date)) problems.push({ problem: "date_invalid" });
    else if (date > context.today) problems.push({ problem: "date_future" });
    else if (context.deliveredOn !== null && date < context.deliveredOn) problems.push({ problem: "date_before_delivery" });
    for (const item of state.items) {
      if (item.serialNumber.trim().length > MAX_SERIAL_NUMBER_LENGTH) problems.push({ problem: "serial_too_long", lineRef: item.lineRef });
    }
  } else if (step === "method") {
    if (state.returnMethod === null) problems.push({ problem: "method_missing" });
  } else if (step === "resolution") {
    if (state.resolution === null) problems.push({ problem: "resolution_missing" });
  } else if (!state.acknowledged) {
    problems.push({ problem: "acknowledgement_missing" });
  }
  return { ok: problems.length === 0, problems };
}

/** First step (in order) that is not valid, or `null` when the whole wizard is valid. */
export function firstInvalidComplaintStep(
  state: ComplaintWizardState,
  lines: readonly WizardLine[],
  context: ComplaintWizardContext,
): ComplaintWizardStep | null {
  return COMPLAINT_WIZARD_STEPS.find((step) => !checkComplaintWizardStep(step, state, lines, context).ok) ?? null;
}

/** Everything that goes into the submit request (except the key) as a stable string. */
export function complaintSubmitSignature(state: ComplaintWizardState): string {
  return JSON.stringify([
    state.items.map((item) => [item.lineRef, item.quantity, item.serialNumber.trim()]),
    state.defectDescription.trim(),
    state.defectDiscoveredOn,
    state.returnMethod,
    state.resolution,
  ]);
}
