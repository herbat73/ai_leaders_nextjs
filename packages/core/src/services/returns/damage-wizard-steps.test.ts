import { describe, expect, it } from "vitest";

import { DAMAGE_WIZARD_STEPS, checkDamageWizardStep, damageSubmitSignature, firstInvalidDamageStep, type DamageWizardState } from "./damage-wizard-steps";

const lines = [
  { lineRef: "L1", remainingQuantity: 2, eligible: true },
  { lineRef: "L2", remainingQuantity: 0, eligible: false },
];
const context = { today: "2026-11-05", deliveredOn: "2026-11-01" };
const valid: DamageWizardState = {
  kind: "transport",
  items: [{ lineRef: "L1", quantity: 1, reasonCode: "missing_element" }],
  defectDescription: "The box was crushed and the sole is cracked.",
  defectDiscoveredOn: "2026-11-04",
  courierNote: null,
  evidenceFileIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
  resolution: "replacement",
  acknowledged: true,
};
const problemsOf = (step: Parameters<typeof checkDamageWizardStep>[0], state: DamageWizardState) =>
  checkDamageWizardStep(step, state, lines, context).problems.map((entry) => entry.problem);

describe("damage wizard steps", () => {
  it("accepts a complete wizard", () => {
    expect(firstInvalidDamageStep(valid, lines, context)).toBeNull();
  });

  it("checks the items", () => {
    expect(problemsOf("items", { ...valid, items: [] })).toEqual(["no_items"]);
    expect(problemsOf("items", { ...valid, items: [{ lineRef: "L2", quantity: 1, reasonCode: "missing_element" }] })).toEqual(["ineligible"]);
    expect(problemsOf("items", { ...valid, items: [{ lineRef: "L1", quantity: 3, reasonCode: "missing_element" }] })).toEqual(["quantity"]);
    expect(problemsOf("items", { ...valid, items: [{ lineRef: "L1", quantity: 0, reasonCode: "missing_element" }] })).toEqual(["quantity"]);
  });

  it.each([
    [{ defectDescription: "short" }, "description_too_short"],
    [{ defectDescription: "x".repeat(2001) }, "description_too_long"],
    [{ defectDiscoveredOn: "" }, "date_missing"],
    [{ defectDiscoveredOn: "2026-02-31" }, "date_invalid"],
    [{ defectDiscoveredOn: "2026-11-06" }, "date_future"],
    [{ defectDiscoveredOn: "2026-10-31" }, "date_before_delivery"],
  ])("checks the details: %j", (patch, problem) => {
    expect(problemsOf("details", { ...valid, ...patch })).toEqual([problem]);
  });

  it("does not require the courier note (Q11)", () => {
    expect(problemsOf("details", { ...valid, courierNote: null })).toEqual([]);
  });

  it("requires one to six photos before the remedy", () => {
    expect(problemsOf("photos", { ...valid, evidenceFileIds: [] })).toEqual(["photos_missing"]);
    expect(problemsOf("photos", valid)).toEqual([]);
    expect(problemsOf("photos", { ...valid, evidenceFileIds: Array.from({ length: 6 }, (_, i) => String(i)) })).toEqual([]);
    expect(problemsOf("photos", { ...valid, evidenceFileIds: Array.from({ length: 7 }, (_, i) => String(i)) })).toEqual(["photos_too_many"]);
    expect(firstInvalidDamageStep({ ...valid, evidenceFileIds: [], resolution: null }, lines, context)).toBe("photos");
  });

  it("puts the photos step between the details and the remedy", () => {
    expect(DAMAGE_WIZARD_STEPS).toEqual(["items", "details", "photos", "resolution", "summary"]);
  });

  it("changes the signature when a photo is added, so a retry after a change gets a new idempotency key", () => {
    expect(damageSubmitSignature(valid)).not.toBe(damageSubmitSignature({ ...valid, evidenceFileIds: [...valid.evidenceFileIds, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"] }));
  });

  it("checks the remedy against the kind", () => {
    expect(problemsOf("resolution", { ...valid, resolution: null })).toEqual(["resolution_missing"]);
    expect(problemsOf("resolution", { ...valid, resolution: "resend_part" })).toEqual(["resolution_not_allowed"]);
    expect(problemsOf("resolution", { ...valid, kind: "missing", resolution: "resend_part" })).toEqual([]);
  });

  it("requires the acknowledgement and reports the first invalid step", () => {
    expect(problemsOf("summary", { ...valid, acknowledged: false })).toEqual(["acknowledgement_missing"]);
    expect(firstInvalidDamageStep({ ...valid, resolution: null, acknowledged: false }, lines, context)).toBe("resolution");
  });

  it("ignores the courier note in the signature of a missing report", () => {
    const a = damageSubmitSignature({ ...valid, kind: "missing", courierNote: true });
    expect(a).toBe(damageSubmitSignature({ ...valid, kind: "missing", courierNote: false }));
    expect(damageSubmitSignature({ ...valid, courierNote: true })).not.toBe(damageSubmitSignature({ ...valid, courierNote: false }));
  });
});
