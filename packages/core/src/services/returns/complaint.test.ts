import { describe, expect, it } from "vitest";

import { money } from "../../domain/money";
import { complaintSubmitSchema } from "../../validators/returns/complaint-submit.schema";
import { complaintQuoteSchema } from "../../validators/returns/complaint-quote.schema";
import { quoteRequestSchema, submitRequestSchema } from "../../validators/returns/return-kind.schema";
import { returnStatusUpdateSchema } from "../../validators/returns/return-status-update.schema";
import type { ReturnOrder } from "../orders/order-lookup.port";
import { calculateComplaintQuote } from "./complaint-quote";
import { checkComplaintEligibility, complaintWindowEnd, isWithinComplaintWindow, warsawDateString } from "./complaint-eligibility";
import { complaintDaysLeft, complaintDueAt, complaintEscalated, complaintEscalatesAt } from "./complaint-sla";
import { complaintStateMachine, returnStateMachine, stateMachineFor } from "./transitions";
import { validateQuoteLines } from "./quote";

function order(deliveredAt: Date | null): ReturnOrder {
  return {
    orderNumber: "AB-1",
    customerEmail: "buyer@example.pl",
    deliveredAt,
    lines: [
      { lineRef: "L1", sku: "S1", name: "Kettle", quantity: 3, unitPrice: money(10000), returnable: true },
      { lineRef: "L2", sku: "S2", name: "Mattress", quantity: 1, unitPrice: money(5000), returnable: false },
    ],
  };
}

describe("complaint window (R02)", () => {
  it("ends 24 months after delivery on the same calendar date", () => {
    expect(complaintWindowEnd(new Date("2024-03-15T10:00:00Z"))).toEqual({ year: 2026, month: 3, day: 15 });
  });

  it("falls back to the last day of the month for 29 February", () => {
    expect(complaintWindowEnd(new Date("2024-02-29T10:00:00Z"))).toEqual({ year: 2026, month: 2, day: 28 });
  });

  it("is open on the last day and closed the day after (Warsaw calendar)", () => {
    const delivered = new Date("2024-03-15T10:00:00Z");
    expect(isWithinComplaintWindow(delivered, new Date("2026-03-15T21:00:00Z"))).toBe(true);
    expect(isWithinComplaintWindow(delivered, new Date("2026-03-15T23:30:00Z"))).toBe(false);
  });
});

describe("checkComplaintEligibility", () => {
  const now = new Date("2026-10-25T10:00:00Z");

  it("reports an undelivered order", () => {
    expect(checkComplaintEligibility(order(null), now, {})).toEqual({ status: "not_delivered", trackingUrl: null });
  });

  it("accepts non-returnable lines (R06)", () => {
    const result = checkComplaintEligibility(order(new Date("2026-09-01T10:00:00Z")), now, {});
    if (result.status !== "delivered") throw new Error("expected delivered");
    expect(result.lines.map((l) => [l.lineRef, l.eligible])).toEqual([["L1", true], ["L2", true]]);
  });

  it("marks every line outside the window", () => {
    const result = checkComplaintEligibility(order(new Date("2024-01-01T10:00:00Z")), now, {});
    if (result.status !== "delivered") throw new Error("expected delivered");
    expect(result.lines.every((l) => l.ineligibleReason === "outside_window")).toBe(true);
  });

  it("shares the claimed quantity with returns", () => {
    const eligibility = checkComplaintEligibility(order(new Date("2026-09-01T10:00:00Z")), now, { L1: 2, L2: 1 });
    if (eligibility.status !== "delivered") throw new Error("expected delivered");
    expect(eligibility.lines[0]).toMatchObject({ remainingQuantity: 1, eligible: true });
    expect(eligibility.lines[1]).toMatchObject({ remainingQuantity: 0, ineligibleReason: "already_claimed" });
    expect(validateQuoteLines(eligibility, [{ lineRef: "L1", quantity: 2 }])).toEqual({ L1: "already_claimed" });
  });
});

describe("calculateComplaintQuote", () => {
  const lines = [{ lineRef: "L1", quantity: 2 }, { lineRef: "L2", quantity: 1 }];
  const o = order(new Date("2026-09-01T10:00:00Z"));

  it("refunds the goods value without a shipping deduction", () => {
    expect(calculateComplaintQuote(o, { lines, resolution: "refund" })).toEqual({ amount: money(25000), fee: money(0) });
  });

  it.each(["repair", "replacement"] as const)("carries no amount for %s", (resolution) => {
    expect(calculateComplaintQuote(o, { lines, resolution })).toEqual({ amount: null, fee: null });
  });

  it("throws for an unknown line", () => {
    expect(() => calculateComplaintQuote(o, { lines: [{ lineRef: "X", quantity: 1 }], resolution: "refund" })).toThrow(RangeError);
  });
});

describe("complaint deadline (R04, Q07)", () => {
  const created = new Date("2026-10-01T10:00:00Z");

  it("is due after 14 calendar days and escalates after 10", () => {
    expect(complaintDueAt(created).toISOString()).toBe("2026-10-15T10:00:00.000Z");
    expect(complaintEscalatesAt(created).toISOString()).toBe("2026-10-11T10:00:00.000Z");
  });

  it("keeps the Warsaw time of day across the DST change", () => {
    expect(complaintDueAt(new Date("2026-10-20T10:00:00Z")).toISOString()).toBe("2026-11-03T11:00:00.000Z");
  });

  it("counts calendar days left, negative when overdue", () => {
    expect(complaintDaysLeft(created, new Date("2026-10-05T08:00:00Z"))).toBe(10);
    expect(complaintDaysLeft(created, new Date("2026-10-15T08:00:00Z"))).toBe(0);
    expect(complaintDaysLeft(created, new Date("2026-10-17T08:00:00Z"))).toBe(-2);
  });

  it("escalates only a complaint still waiting for an answer", () => {
    const later = new Date("2026-10-12T08:00:00Z");
    expect(complaintEscalated("submitted", created, new Date("2026-10-10T08:00:00Z"))).toBe(false);
    expect(complaintEscalated("submitted", created, later)).toBe(true);
    expect(complaintEscalated("approved", created, later)).toBe(false);
    expect(complaintEscalated("unknown", created, later)).toBe(false);
  });
});

describe("complaint state machine", () => {
  it("adds the repair path that returns lack", () => {
    expect(complaintStateMachine.can("received", "in_service")).toBe(true);
    expect(complaintStateMachine.can("in_service", "resolved")).toBe(true);
    expect(returnStateMachine.can("received", "in_service")).toBe(false);
  });

  it("keeps the shared beginning", () => {
    expect(complaintStateMachine.allowed("submitted")).toEqual(["approved", "rejected"]);
  });

  it("picks the machine by kind", () => {
    expect(stateMachineFor("complaint")).toBe(complaintStateMachine);
    expect(stateMachineFor("return")).toBe(returnStateMachine);
    expect(stateMachineFor(undefined)).toBe(returnStateMachine);
  });
});

describe("complaintSubmitSchema", () => {
  const now = new Date("2026-10-25T10:00:00Z");
  const base = {
    kind: "complaint",
    items: [{ lineRef: "L1", quantity: 1, serialNumber: "SN-1" }],
    defectDescription: "The heating element stopped working after a week.",
    defectDiscoveredOn: "2026-10-20",
    resolution: "repair",
    returnMethod: "courier",
    acknowledged: true,
    idempotencyKey: "6f1c2b1e-0a52-4c8e-9a76-3c8a1c1d2e3f",
  };

  it("accepts a complete complaint", () => {
    expect(complaintSubmitSchema(now).safeParse(base).success).toBe(true);
  });

  it.each([
    ["a short description", { defectDescription: "too short" }, "defectDescription"],
    ["a future discovery date", { defectDiscoveredOn: "2026-10-26" }, "defectDiscoveredOn"],
    ["an impossible date", { defectDiscoveredOn: "2026-02-30" }, "defectDiscoveredOn"],
    ["a return-only resolution", { resolution: "store_credit" }, "resolution"],
    ["no acknowledgement", { acknowledged: false }, "acknowledged"],
    ["a duplicate line", { items: [{ lineRef: "L1", quantity: 1 }, { lineRef: "L1", quantity: 1 }] }, "items"],
  ])("rejects %s", (_name, patch, field) => {
    const result = complaintSubmitSchema(now).safeParse({ ...base, ...patch });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path[0]).toBe(field);
  });

  it("accepts today as the discovery date (Warsaw)", () => {
    expect(complaintSubmitSchema(new Date("2026-10-25T23:30:00Z")).safeParse({ ...base, defectDiscoveredOn: "2026-10-26" }).success).toBe(true);
    expect(warsawDateString(new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-26");
  });
});

describe("complaintQuoteSchema", () => {
  it("accepts a complaint remedy and rejects a return one", () => {
    const body = { kind: "complaint", items: [{ lineRef: "L1", quantity: 1 }], returnMethod: "store", resolution: "replacement" };
    expect(complaintQuoteSchema.safeParse(body).success).toBe(true);
    expect(complaintQuoteSchema.safeParse({ ...body, resolution: "exchange" }).success).toBe(false);
  });
});

describe("returnStatusUpdateSchema defectConfirmed", () => {
  it("passes the finding through and omits it when absent", () => {
    expect(returnStatusUpdateSchema.parse({ status: "received", defectConfirmed: false })).toEqual({ status: "received", defectConfirmed: false });
    expect(returnStatusUpdateSchema.parse({ status: "received" })).toEqual({ status: "received" });
  });
});

describe("kind dispatch", () => {
  const now = new Date("2026-10-25T10:00:00Z");
  const complaintBody = {
    kind: "complaint",
    items: [{ lineRef: "L1", quantity: 1 }],
    defectDescription: "The heating element stopped working after a week.",
    defectDiscoveredOn: "2026-10-20",
    resolution: "replacement",
    returnMethod: "store",
    acknowledged: true,
    idempotencyKey: "6f1c2b1e-0a52-4c8e-9a76-3c8a1c1d2e3f",
  };
  const returnBody = {
    items: [{ lineRef: "L1", quantity: 1, reasonCode: "size" }],
    resolution: "refund",
    returnMethod: "store",
    acknowledged: true,
    idempotencyKey: "6f1c2b1e-0a52-4c8e-9a76-3c8a1c1d2e3f",
  };

  it("treats a body without kind as a return", () => {
    expect(submitRequestSchema(now).safeParse(returnBody).success).toBe(true);
    expect(submitRequestSchema(now).safeParse(complaintBody).success).toBe(true);
  });

  it("does not let a complaint remedy through the return schema, or the reverse", () => {
    expect(submitRequestSchema(now).safeParse({ ...returnBody, resolution: "repair" }).success).toBe(false);
    expect(submitRequestSchema(now).safeParse({ ...complaintBody, resolution: "exchange" }).success).toBe(false);
  });

  it("keeps the path of an issue from the chosen schema", () => {
    const result = submitRequestSchema(now).safeParse({ ...complaintBody, defectDescription: "short" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["defectDescription"]);
  });

  it("dispatches quotes the same way", () => {
    expect(quoteRequestSchema.safeParse({ items: [{ lineRef: "L1", quantity: 1 }], returnMethod: "store", resolution: "exchange" }).success).toBe(true);
    expect(quoteRequestSchema.safeParse({ kind: "complaint", items: [{ lineRef: "L1", quantity: 1 }], returnMethod: "store", resolution: "exchange" }).success).toBe(false);
  });
});
