import { describe, expect, it } from "vitest";

import { damageSubmitSchema } from "./damage-submit.schema";
import { damageQuoteSchema } from "./damage-quote.schema";
import { quoteRequestSchema, submitRequestSchema } from "./return-kind.schema";

const now = new Date("2026-11-05T10:00:00Z");
const base = {
  kind: "transport",
  items: [{ lineRef: "L1", quantity: 1 }],
  defectDescription: "The box was crushed and the sole is cracked.",
  defectDiscoveredOn: "2026-11-04",
  courierNote: false,
  resolution: "replacement",
  acknowledged: true,
  idempotencyKey: "6f1c2b1e-0a52-4c8e-9a76-3c8a1c1d2e3f",
};
const pathsOf = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.join(".")) ?? [];

describe("damageSubmitSchema", () => {
  it("accepts a complete transport report and a complete missing report", () => {
    expect(damageSubmitSchema(now).safeParse(base).success).toBe(true);
    const missing = { ...base, kind: "missing", courierNote: undefined, resolution: "resend_part", items: [{ lineRef: "L1", quantity: 1, reasonCode: "wrong_item" }] };
    expect(damageSubmitSchema(now).safeParse(missing).success).toBe(true);
  });

  it("takes the courier note as optional", () => {
    const { courierNote: _omit, ...without } = base;
    expect(damageSubmitSchema(now).safeParse(without).success).toBe(true);
  });

  it.each([
    ["a short description", { defectDescription: "too short" }, "defectDescription"],
    ["a long description", { defectDescription: "x".repeat(2001) }, "defectDescription"],
    ["a future date", { defectDiscoveredOn: "2026-11-06" }, "defectDiscoveredOn"],
    ["an impossible date", { defectDiscoveredOn: "2026-02-31" }, "defectDiscoveredOn"],
    ["resend_part for transport", { resolution: "resend_part" }, "resolution"],
    ["a store credit remedy", { resolution: "store_credit" }, "resolution"],
    ["a duplicate line", { items: [{ lineRef: "L1", quantity: 1 }, { lineRef: "L1", quantity: 1 }] }, "items.1.lineRef"],
    ["no items", { items: [] }, "items"],
    ["a missing acknowledgement", { acknowledged: false }, "acknowledged"],
    ["a non-UUID key", { idempotencyKey: "abc" }, "idempotencyKey"],
    ["a reason code on transport", { items: [{ lineRef: "L1", quantity: 1, reasonCode: "wrong_item" }] }, "items.0.reasonCode"],
    ["a courier note on a missing report", { kind: "missing" }, "courierNote"],
  ])("rejects %s", (_name, patch, path) => {
    const result = damageSubmitSchema(now).safeParse({ ...base, ...patch });
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain(path);
  });

  it("drops a return method and evidence ids it does not read", () => {
    const result = damageSubmitSchema(now).safeParse({ ...base, returnMethod: "courier", evidenceFileIds: ["x"] });
    expect(result.success && Object.keys(result.data)).not.toContain("returnMethod");
    expect(result.success && Object.keys(result.data)).not.toContain("evidenceFileIds");
  });
});

describe("damageQuoteSchema", () => {
  const quote = { kind: "missing", items: [{ lineRef: "L1", quantity: 1 }], resolution: "resend_part" };

  it("accepts the remedies of each kind", () => {
    expect(damageQuoteSchema.safeParse(quote).success).toBe(true);
    expect(damageQuoteSchema.safeParse({ ...quote, kind: "transport", resolution: "refund" }).success).toBe(true);
  });

  it("rejects resend_part for transport and duplicate lines", () => {
    expect(damageQuoteSchema.safeParse({ ...quote, kind: "transport" }).success).toBe(false);
    expect(damageQuoteSchema.safeParse({ ...quote, items: [quote.items[0], quote.items[0]] }).success).toBe(false);
  });
});

describe("dispatch on kind", () => {
  it("sends transport and missing to the damage schemas and keeps return and complaint", () => {
    expect(submitRequestSchema(now).safeParse(base).success).toBe(true);
    expect(submitRequestSchema(now).safeParse({ ...base, kind: "missing", courierNote: undefined, resolution: "resend_part" }).success).toBe(true);
    // A damage body is not a return: it has no reasonCode or returnMethod.
    expect(submitRequestSchema(now).safeParse({ ...base, kind: "return" }).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ kind: "transport", items: [{ lineRef: "L1", quantity: 1 }], resolution: "refund" }).success).toBe(true);
    expect(quoteRequestSchema.safeParse({ kind: "transport", items: [{ lineRef: "L1", quantity: 1 }], resolution: "resend_part" }).success).toBe(false);
  });

  it("reports the path of a damage issue", () => {
    const result = submitRequestSchema(now).safeParse({ ...base, defectDescription: "short" });
    expect(result.success).toBe(false);
    expect(pathsOf(result as never)).toContain("defectDescription");
  });
});
