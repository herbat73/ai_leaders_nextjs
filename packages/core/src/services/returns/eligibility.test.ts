import { describe, expect, it } from "vitest";

import { money } from "../../domain/money";
import type { ReturnOrder } from "../orders/order-lookup.port";
import { checkEligibility, clampReturnWindowDays, daysSinceDelivery, safeHttpUrl } from "./eligibility";

const CONFIG = { windowDays: 30 };

function order(deliveredAt: Date | null, extra: Partial<ReturnOrder> = {}): ReturnOrder {
  return {
    orderNumber: "AB-1",
    customerEmail: "buyer@example.pl",
    deliveredAt,
    lines: [
      { lineRef: "L1", sku: "S1", name: "Shoe", quantity: 3, unitPrice: money(10000), returnable: true },
      { lineRef: "L2", sku: "S2", name: "Gift card", quantity: 1, unitPrice: money(5000), returnable: false },
    ],
    ...extra,
  };
}

function l1(result: ReturnType<typeof checkEligibility>) {
  if (result.status !== "delivered") throw new Error("expected delivered");
  return result.lines.find((l) => l.lineRef === "L1")!;
}

describe("clampReturnWindowDays", () => {
  it.each([
    [undefined, 30],
    ["", 30],
    ["abc", 30],
    ["NaN", 30],
    ["30", 30],
    ["13", 14],
    ["14", 14],
    ["365", 365],
    ["366", 365],
    ["0", 14],
    ["-5", 14],
    ["45.9", 45],
    [60, 60],
    [Number.NaN, 30],
  ])("%j -> %i", (raw, expected) => {
    expect(clampReturnWindowDays(raw)).toBe(expected);
  });
});

describe("window", () => {
  const delivered = new Date("2026-03-10T12:00:00Z");
  const at = (days: number) => new Date(delivered.getTime() + days * 86_400_000);

  it.each([
    [13, 14, true],
    [14, 14, true],
    [15, 14, false],
    [30, 30, true],
    [31, 30, false],
    [365, 365, true],
    [366, 365, false],
  ])("%i days after delivery with a %i day window is returnable: %s", (days, windowDays, ok) => {
    const result = checkEligibility(order(delivered), at(days), { windowDays }, {});
    expect(l1(result).eligible).toBe(ok);
    if (!ok) expect(l1(result).ineligibleReason).toBe("outside_window");
  });

  it("counts calendar days in Warsaw: delivery 23:30 local is day 0, the next local morning is day 1", () => {
    const late = new Date("2026-01-10T22:30:00Z"); // 23:30 Warsaw (CET)
    expect(daysSinceDelivery(late, new Date("2026-01-10T23:30:00Z"))).toBe(1); // 00:30 Warsaw next day
    expect(daysSinceDelivery(late, new Date("2026-01-10T22:59:00Z"))).toBe(0);
  });

  it("uses the Warsaw date, not UTC, for the last returnable day", () => {
    const late = new Date("2026-01-10T22:30:00Z"); // Jan 10 local
    // Last day is Feb 9 local (30 days); 22:59 UTC on Feb 9 is 23:59 local, 23:00 UTC is Feb 10 local.
    expect(checkEligibility(order(late), new Date("2026-02-09T22:59:00Z"), CONFIG, {})).toMatchObject({ status: "delivered" });
    expect(l1(checkEligibility(order(late), new Date("2026-02-09T22:59:00Z"), CONFIG, {})).eligible).toBe(true);
    expect(l1(checkEligibility(order(late), new Date("2026-02-09T23:00:00Z"), CONFIG, {})).eligible).toBe(false);
  });

  it("is not shifted by a DST change (spring forward 2026-03-29)", () => {
    const before = new Date("2026-03-28T22:30:00Z"); // 23:30 CET on Mar 28
    expect(daysSinceDelivery(before, new Date("2026-03-29T21:30:00Z"))).toBe(1); // 23:30 CEST on Mar 29
    expect(daysSinceDelivery(before, new Date("2026-03-29T22:30:00Z"))).toBe(2); // 00:30 CEST on Mar 30
  });

  it("is not shifted by a DST change (fall back 2026-10-25)", () => {
    const before = new Date("2026-10-24T21:30:00Z"); // 23:30 CEST on Oct 24
    expect(daysSinceDelivery(before, new Date("2026-10-25T22:30:00Z"))).toBe(1); // 23:30 CET on Oct 25
    expect(daysSinceDelivery(before, new Date("2026-10-25T23:30:00Z"))).toBe(2); // 00:30 CET on Oct 26
  });
});

describe("checkEligibility", () => {
  const delivered = new Date("2026-03-10T12:00:00Z");
  const now = new Date("2026-03-15T12:00:00Z");

  it("answers an undelivered order with the tracking link and no lines", () => {
    expect(checkEligibility(order(null, { trackingUrl: "https://t.example/1" }), now, CONFIG, {})).toEqual({
      status: "not_delivered",
      trackingUrl: "https://t.example/1",
    });
    expect(checkEligibility(order(null), now, CONFIG, {})).toEqual({ status: "not_delivered", trackingUrl: null });
  });

  it("drops tracking links that are not absolute http(s) URLs", () => {
    expect(safeHttpUrl("https://t.example/1")).toBe("https://t.example/1");
    expect(safeHttpUrl("http://t.example/1")).toBe("http://t.example/1");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "/relative/path", "not a url", "", "  javascript:alert(1)"]) {
      expect(safeHttpUrl(bad)).toBeNull();
    }
    expect(safeHttpUrl(undefined)).toBeNull();
    expect(checkEligibility(order(null, { trackingUrl: "javascript:alert(1)" }), now, CONFIG, {})).toEqual({
      status: "not_delivered",
      trackingUrl: null,
    });
  });

  it("marks non-returnable lines, even inside the window", () => {
    const result = checkEligibility(order(delivered), now, CONFIG, {});
    if (result.status !== "delivered") throw new Error("expected delivered");
    expect(result.lines.find((l) => l.lineRef === "L2")).toMatchObject({ eligible: false, ineligibleReason: "not_returnable" });
  });

  it("not_returnable wins over outside_window", () => {
    const result = checkEligibility(order(delivered), new Date("2027-03-15T12:00:00Z"), CONFIG, {});
    if (result.status !== "delivered") throw new Error("expected delivered");
    expect(result.lines.map((l) => l.ineligibleReason)).toEqual(["outside_window", "not_returnable"]);
  });

  it("remaining quantity is ordered minus claimed", () => {
    expect(l1(checkEligibility(order(delivered), now, CONFIG, { L1: 2 }))).toEqual({
      lineRef: "L1",
      orderedQuantity: 3,
      remainingQuantity: 1,
      eligible: true,
    });
  });

  it("a fully claimed line is already_claimed; no claim for it (cancelled/rejected release) leaves it open", () => {
    expect(l1(checkEligibility(order(delivered), now, CONFIG, { L1: 3 }))).toMatchObject({
      remainingQuantity: 0,
      eligible: false,
      ineligibleReason: "already_claimed",
    });
    // claimedQuantities omits cancelled/rejected requests, so a released line is simply absent from the input.
    expect(l1(checkEligibility(order(delivered), now, CONFIG, {}))).toMatchObject({ remainingQuantity: 3, eligible: true });
  });

  it("never reports a negative remaining quantity", () => {
    expect(l1(checkEligibility(order(delivered), now, CONFIG, { L1: 5 })).remainingQuantity).toBe(0);
  });
});
