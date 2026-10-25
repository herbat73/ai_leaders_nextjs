import { describe, expect, it } from "vitest";

import {
  checkComplaintWizardStep,
  complaintSubmitSignature,
  firstInvalidComplaintStep,
  type ComplaintWizardState,
} from "./complaint-wizard-steps";

const LINES = [
  { lineRef: "L1", remainingQuantity: 2, eligible: true },
  { lineRef: "L2", remainingQuantity: 0, eligible: false },
];
const CONTEXT = { today: "2026-11-05", deliveredOn: "2026-11-01" };

function state(overrides: Partial<ComplaintWizardState> = {}): ComplaintWizardState {
  return {
    items: [{ lineRef: "L1", quantity: 1, serialNumber: "" }],
    defectDescription: "The sole came off after one week of use.",
    defectDiscoveredOn: "2026-11-04",
    returnMethod: "courier",
    resolution: "repair",
    acknowledged: true,
    ...overrides,
  };
}

const problemsOf = (step: Parameters<typeof checkComplaintWizardStep>[0], s: ComplaintWizardState) =>
  checkComplaintWizardStep(step, s, LINES, CONTEXT).problems.map((p) => p.problem);

describe("checkComplaintWizardStep", () => {
  it("accepts a complete complaint on every step", () => {
    expect(firstInvalidComplaintStep(state(), LINES, CONTEXT)).toBeNull();
  });

  it("items: needs a selection within the remaining quantity of an eligible line", () => {
    expect(problemsOf("items", state({ items: [] }))).toEqual(["no_items"]);
    expect(problemsOf("items", state({ items: [{ lineRef: "L1", quantity: 3, serialNumber: "" }] }))).toEqual(["quantity"]);
    expect(problemsOf("items", state({ items: [{ lineRef: "L2", quantity: 1, serialNumber: "" }] }))).toEqual(["ineligible"]);
  });

  it.each([
    ["a short description", { defectDescription: "too short" }, "description_too_short"],
    ["a long description", { defectDescription: "x".repeat(2001) }, "description_too_long"],
    ["no date", { defectDiscoveredOn: "" }, "date_missing"],
    ["an impossible date", { defectDiscoveredOn: "2026-02-30" }, "date_invalid"],
    ["a future date", { defectDiscoveredOn: "2026-11-06" }, "date_future"],
    ["a date before delivery", { defectDiscoveredOn: "2026-10-31" }, "date_before_delivery"],
  ] as const)("defect: rejects %s", (_name, patch, problem) => {
    expect(problemsOf("defect", state(patch))).toEqual([problem]);
  });

  it("defect: counts the trimmed description and flags a long serial number per item", () => {
    expect(problemsOf("defect", state({ defectDescription: `  ${"x".repeat(19)}  ` }))).toEqual(["description_too_short"]);
    const long = state({ items: [{ lineRef: "L1", quantity: 1, serialNumber: "s".repeat(101) }] });
    expect(checkComplaintWizardStep("defect", long, LINES, CONTEXT).problems).toEqual([{ problem: "serial_too_long", lineRef: "L1" }]);
  });

  it("defect: skips the delivery check when the delivery date is unknown", () => {
    const result = checkComplaintWizardStep("defect", state({ defectDiscoveredOn: "2020-01-01" }), LINES, { today: "2026-11-05", deliveredOn: null });
    expect(result.ok).toBe(true);
  });

  it("method, resolution and summary each need their choice", () => {
    expect(problemsOf("method", state({ returnMethod: null }))).toEqual(["method_missing"]);
    expect(problemsOf("resolution", state({ resolution: null }))).toEqual(["resolution_missing"]);
    expect(problemsOf("summary", state({ acknowledged: false }))).toEqual(["acknowledgement_missing"]);
  });

  it("reports the first invalid step in order", () => {
    expect(firstInvalidComplaintStep(state({ defectDescription: "", resolution: null }), LINES, CONTEXT)).toBe("defect");
  });
});

describe("complaintSubmitSignature", () => {
  it("ignores surrounding whitespace and changes with the request", () => {
    expect(complaintSubmitSignature(state({ defectDescription: "  same  " }))).toBe(complaintSubmitSignature(state({ defectDescription: "same" })));
    expect(complaintSubmitSignature(state({ resolution: "refund" }))).not.toBe(complaintSubmitSignature(state()));
  });
});
