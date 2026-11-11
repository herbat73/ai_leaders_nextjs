import { describe, expect, it } from "vitest";

import { money } from "../../domain/money";
import type { ReturnOrder } from "../orders/order-lookup.port";
import { calculateDamageQuote } from "./damage-quote";
import {
  checkDamageEligibility,
  DEFAULT_TRANSPORT_WINDOW_DAYS,
  isWithinTransportWindow,
  parseTransportWindowDays,
} from "./damage-eligibility";
import { checkComplaintEligibility } from "./complaint-eligibility";
import { checkEligibility } from "./eligibility";

const order = (deliveredAt: Date | null): ReturnOrder => ({
  orderNumber: "AB-1",
  customerEmail: "buyer@example.pl",
  deliveredAt,
  trackingUrl: "https://track.example/1",
  lines: [
    { lineRef: "L1", sku: "S1", name: "Kettle", quantity: 3, unitPrice: money(10000), returnable: true },
    { lineRef: "L2", sku: "S2", name: "Mattress", quantity: 1, unitPrice: money(5000), returnable: false },
  ],
});

describe("parseTransportWindowDays", () => {
  it("defaults to 14 when unset or blank", () => {
    expect(parseTransportWindowDays(undefined)).toBe(DEFAULT_TRANSPORT_WINDOW_DAYS);
    expect(parseTransportWindowDays("  ")).toBe(14);
  });

  it.each(["1", "14", "30", " 7 "])("accepts %s", (raw) => {
    expect(parseTransportWindowDays(raw)).toBe(Number(raw.trim()));
  });

  it.each(["0", "31", "-1", "abc", "7.5", "1e1"])("fails on %s like other settings", (raw) => {
    expect(() => parseTransportWindowDays(raw)).toThrow(/EASYRMS_TRANSPORT_WINDOW_DAYS/);
  });
});

describe("transport window edges (Warsaw calendar days, delivery day is day 0)", () => {
  const delivered = new Date("2026-10-01T10:00:00Z");

  it("is open on the last day and closed the day after", () => {
    expect(isWithinTransportWindow(delivered, new Date("2026-10-15T21:00:00Z"), 14)).toBe(true);
    expect(isWithinTransportWindow(delivered, new Date("2026-10-15T22:00:00Z"), 14)).toBe(false); // 16 Oct 00:00 Warsaw
  });

  it("follows a configured window", () => {
    expect(isWithinTransportWindow(delivered, new Date("2026-10-08T10:00:00Z"), 7)).toBe(true);
    expect(isWithinTransportWindow(delivered, new Date("2026-10-09T10:00:00Z"), 7)).toBe(false);
  });
});

describe("checkDamageEligibility", () => {
  const config = { windowDays: 14 };
  const now = new Date("2026-10-05T10:00:00Z");

  it("is not delivered without a delivery date, with a safe tracking link", () => {
    expect(checkDamageEligibility(order(null), now, config, {})).toEqual({ status: "not_delivered", trackingUrl: "https://track.example/1" });
  });

  it("allows returnable=false lines, unlike a return", () => {
    const delivered = order(new Date("2026-10-01T10:00:00Z"));
    const result = checkDamageEligibility(delivered, now, config, {});
    expect(result.status === "delivered" && result.lines.map((l) => l.eligible)).toEqual([true, true]);
    const asReturn = checkEligibility(delivered, now, { windowDays: 30 }, {});
    expect(asReturn.status === "delivered" && asReturn.lines[1]?.ineligibleReason).toBe("not_returnable");
  });

  it("closes every line outside the window", () => {
    const result = checkDamageEligibility(order(new Date("2026-09-01T10:00:00Z")), now, config, {});
    expect(result.status === "delivered" && result.lines.every((l) => l.ineligibleReason === "outside_window")).toBe(true);
  });

  it("shares the quantity pool with open returns and complaints", () => {
    const delivered = order(new Date("2026-10-01T10:00:00Z"));
    const result = checkDamageEligibility(delivered, now, config, { L1: 2, L2: 1 });
    expect(result).toEqual({
      status: "delivered",
      lines: [
        { lineRef: "L1", orderedQuantity: 3, remainingQuantity: 1, eligible: true },
        { lineRef: "L2", orderedQuantity: 1, remainingQuantity: 0, eligible: false, ineligibleReason: "already_claimed" },
      ],
    });
    // The same pool is what complaints see, so a unit held by one blocks the other.
    expect(checkComplaintEligibility(delivered, now, { L1: 3 }).status).toBe("delivered");
  });

  it("outside the window wins over already claimed", () => {
    const result = checkDamageEligibility(order(new Date("2026-09-01T10:00:00Z")), now, config, { L1: 3 });
    expect(result.status === "delivered" && result.lines[0]?.ineligibleReason).toBe("outside_window");
  });
});

describe("calculateDamageQuote", () => {
  const o = order(new Date("2026-10-01T10:00:00Z"));

  it("refunds the goods value with no fee", () => {
    const quote = calculateDamageQuote(o, { lines: [{ lineRef: "L1", quantity: 2 }, { lineRef: "L2", quantity: 1 }], resolution: "refund" });
    expect(quote.amount).toEqual(money(25000));
    expect(quote.fee).toEqual(money(0));
  });

  it.each(["replacement", "resend_part"] as const)("carries no amount for %s", (resolution) => {
    expect(calculateDamageQuote(o, { lines: [{ lineRef: "L1", quantity: 1 }], resolution })).toEqual({ amount: null, fee: null });
  });

  it("throws on an unknown line", () => {
    expect(() => calculateDamageQuote(o, { lines: [{ lineRef: "X", quantity: 1 }], resolution: "refund" })).toThrow(RangeError);
  });
});
