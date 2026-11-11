import {
  COMPLAINT_DESCRIPTION_MAX_LENGTH,
  COMPLAINT_DESCRIPTION_MIN_LENGTH,
} from "../../validators/returns/complaint-submit.schema";
import { MAX_EVIDENCE_FILES } from "../evidence/types";
import { isDamageResolutionOf } from "../../validators/returns/damage-quote.schema";
import type { WizardLine } from "./wizard-steps";
import type { DamageKind, DamageResolution, MissingReasonCode } from "./types";

/**
 * Steps of the shared wizard for transport damage and missing items: one to six photos are required (Q2, Q14), so the
 * `photos` step sits before `resolution`. Neither kind has a return method.
 */
export const DAMAGE_WIZARD_STEPS = ["items", "details", "photos", "resolution", "summary"] as const;
export type DamageWizardStep = (typeof DAMAGE_WIZARD_STEPS)[number];

export interface DamageWizardItemState {
  lineRef: string;
  quantity: number;
  /** Missing items only: what is wrong with the line. */
  reasonCode: MissingReasonCode;
}

export interface DamageWizardState {
  kind: DamageKind;
  items: DamageWizardItemState[];
  defectDescription: string;
  /** `YYYY-MM-DD` or empty. */
  defectDiscoveredOn: string;
  /** Transport only; `null` is "I do not know / not answered" (Q11, optional). */
  courierNote: boolean | null;
  /** Ids of photos already uploaded and staged by this session; a file still uploading or failed is not in it. */
  evidenceFileIds: string[];
  resolution: DamageResolution | null;
  acknowledged: boolean;
}

export type DamageWizardProblem =
  | "no_items"
  | "quantity"
  | "ineligible"
  | "description_too_short"
  | "description_too_long"
  | "date_missing"
  | "date_invalid"
  | "date_future"
  | "date_before_delivery"
  | "photos_missing"
  | "photos_too_many"
  | "resolution_missing"
  | "resolution_not_allowed"
  | "acknowledgement_missing";

export interface DamageStepCheck {
  ok: boolean;
  problems: { problem: DamageWizardProblem; lineRef?: string }[];
}

/** Today's Warsaw date and the delivery's, both `YYYY-MM-DD`. */
export interface DamageWizardContext {
  today: string;
  deliveredOn: string | null;
}

function isRealDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
}

/** Pure validity of one step (the server re-validates everything; this only gates "Next"). */
export function checkDamageWizardStep(
  step: DamageWizardStep,
  state: DamageWizardState,
  lines: readonly WizardLine[],
  context: DamageWizardContext,
): DamageStepCheck {
  const problems: DamageStepCheck["problems"] = [];
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
  } else if (step === "details") {
    const description = state.defectDescription.trim();
    if (description.length < COMPLAINT_DESCRIPTION_MIN_LENGTH) problems.push({ problem: "description_too_short" });
    else if (description.length > COMPLAINT_DESCRIPTION_MAX_LENGTH) problems.push({ problem: "description_too_long" });
    const date = state.defectDiscoveredOn;
    if (date === "") problems.push({ problem: "date_missing" });
    else if (!isRealDate(date)) problems.push({ problem: "date_invalid" });
    else if (date > context.today) problems.push({ problem: "date_future" });
    else if (context.deliveredOn !== null && date < context.deliveredOn) problems.push({ problem: "date_before_delivery" });
  } else if (step === "photos") {
    if (state.evidenceFileIds.length === 0) problems.push({ problem: "photos_missing" });
    else if (state.evidenceFileIds.length > MAX_EVIDENCE_FILES) problems.push({ problem: "photos_too_many" });
  } else if (step === "resolution") {
    if (state.resolution === null) problems.push({ problem: "resolution_missing" });
    else if (!isDamageResolutionOf(state.kind, state.resolution)) problems.push({ problem: "resolution_not_allowed" });
  } else if (!state.acknowledged) {
    problems.push({ problem: "acknowledgement_missing" });
  }
  return { ok: problems.length === 0, problems };
}

/** First step (in order) that is not valid, or `null` when the whole wizard is valid. */
export function firstInvalidDamageStep(
  state: DamageWizardState,
  lines: readonly WizardLine[],
  context: DamageWizardContext,
): DamageWizardStep | null {
  return DAMAGE_WIZARD_STEPS.find((step) => !checkDamageWizardStep(step, state, lines, context).ok) ?? null;
}

/** Everything that goes into the submit request (except the key) as a stable string. */
export function damageSubmitSignature(state: DamageWizardState): string {
  return JSON.stringify([
    state.kind,
    state.items.map((item) => [item.lineRef, item.quantity, state.kind === "missing" ? item.reasonCode : null]),
    state.defectDescription.trim(),
    state.defectDiscoveredOn,
    state.kind === "transport" ? state.courierNote : null,
    state.evidenceFileIds,
    state.resolution,
  ]);
}
