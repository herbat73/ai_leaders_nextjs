import { describe, expect, it } from "vitest";

import { checkWizardStep, firstInvalidStep, needsNewIdempotencyKey, refusedLinesFromFieldErrors, submitSignature, type WizardLine, type WizardState } from "./wizard-steps";

const lines: WizardLine[] = [
  { lineRef: "L1", remainingQuantity: 3, eligible: true },
  { lineRef: "L2", remainingQuantity: 0, eligible: false },
];

function state(overrides: Partial<WizardState> = {}): WizardState {
  return {
    items: [{ lineRef: "L1", quantity: 2, reasonCode: "size", comment: "" }],
    returnMethod: "store",
    resolution: "refund",
    exchangeNote: "",
    acknowledged: true,
    ...overrides,
  };
}

const problems = (step: Parameters<typeof checkWizardStep>[0], s: WizardState): string[] =>
  checkWizardStep(step, s, lines).problems.map((p) => p.problem);

describe("checkWizardStep", () => {
  it("accepts a complete state on every step", () => {
    expect(firstInvalidStep(state(), lines)).toBeNull();
  });

  it("items: requires at least one item within 1..remaining", () => {
    expect(problems("items", state({ items: [] }))).toEqual(["no_items"]);
    expect(problems("items", state({ items: [{ lineRef: "L1", quantity: 0, reasonCode: null, comment: "" }] }))).toEqual(["quantity"]);
    expect(problems("items", state({ items: [{ lineRef: "L1", quantity: 4, reasonCode: null, comment: "" }] }))).toEqual(["quantity"]);
    expect(problems("items", state({ items: [{ lineRef: "L1", quantity: 1.5, reasonCode: null, comment: "" }] }))).toEqual(["quantity"]);
    expect(problems("items", state({ items: [{ lineRef: "L1", quantity: 3, reasonCode: null, comment: "" }] }))).toEqual([]);
  });

  it("items: rejects an ineligible or unknown line", () => {
    const check = checkWizardStep("items", state({ items: [{ lineRef: "L2", quantity: 1, reasonCode: "size", comment: "" }, { lineRef: "X", quantity: 1, reasonCode: "size", comment: "" }] }), lines);
    expect(check.problems).toEqual([
      { problem: "ineligible", lineRef: "L2" },
      { problem: "ineligible", lineRef: "X" },
    ]);
  });

  it("reasons: a reason per item, comment up to 500", () => {
    const missing = state({ items: [{ lineRef: "L1", quantity: 1, reasonCode: null, comment: "" }] });
    expect(checkWizardStep("reasons", missing, lines).problems).toEqual([{ problem: "reason_missing", lineRef: "L1" }]);
    const long = state({ items: [{ lineRef: "L1", quantity: 1, reasonCode: "other", comment: "x".repeat(501) }] });
    expect(problems("reasons", long)).toEqual(["comment_too_long"]);
    const edge = state({ items: [{ lineRef: "L1", quantity: 1, reasonCode: "other", comment: "x".repeat(500) }] });
    expect(problems("reasons", edge)).toEqual([]);
  });

  it("method and resolution must be chosen", () => {
    expect(problems("method", state({ returnMethod: null }))).toEqual(["method_missing"]);
    expect(problems("resolution", state({ resolution: null }))).toEqual(["resolution_missing"]);
  });

  it("exchange needs a note of 1..200 characters (trimmed); other resolutions do not", () => {
    expect(problems("resolution", state({ resolution: "exchange", exchangeNote: "   " }))).toEqual(["exchange_note_missing"]);
    expect(problems("resolution", state({ resolution: "exchange", exchangeNote: "x".repeat(201) }))).toEqual(["exchange_note_too_long"]);
    expect(problems("resolution", state({ resolution: "exchange", exchangeNote: "x".repeat(200) }))).toEqual([]);
    expect(problems("resolution", state({ resolution: "store_credit", exchangeNote: "" }))).toEqual([]);
  });

  it("summary requires the acknowledgement", () => {
    expect(problems("summary", state({ acknowledged: false }))).toEqual(["acknowledgement_missing"]);
  });

  it("firstInvalidStep reports the earliest broken step", () => {
    expect(firstInvalidStep(state({ returnMethod: null, acknowledged: false }), lines)).toBe("method");
  });

  it("refusedLinesFromFieldErrors keeps only items.* entries", () => {
    expect(refusedLinesFromFieldErrors({ "items.L1": "already_returned", idempotencyKey: "x" })).toEqual({ L1: "already_returned" });
    expect(refusedLinesFromFieldErrors({ idempotencyKey: "x" })).toEqual({});
  });

  it("idempotency key is regenerated only when the request changed after a failure", () => {
    const base = state({ resolution: "exchange", exchangeNote: "M" });
    const sig = submitSignature(base);
    expect(needsNewIdempotencyKey(null, sig)).toBe(false);
    expect(needsNewIdempotencyKey(sig, submitSignature(base))).toBe(false);
    expect(needsNewIdempotencyKey(sig, submitSignature({ ...base, exchangeNote: "L" }))).toBe(true);
    expect(needsNewIdempotencyKey(sig, submitSignature({ ...base, returnMethod: "courier" }))).toBe(true);
    expect(needsNewIdempotencyKey(sig, submitSignature({ ...base, acknowledged: !base.acknowledged }))).toBe(false);
  });
});
