import { describe, expect, it } from "vitest";

import { ConfigurationError } from "../../errors";
import { money } from "../../domain/money";
import type { ReturnOrder } from "../orders/order-lookup.port";
import { checkEligibility } from "./eligibility";
import { calculateQuote, parseShippingFee, toQuoteView, validateQuoteLines, type ReturnQuoteInput } from "./quote";

const ORDER: ReturnOrder = {
  orderNumber: "AB-1",
  customerEmail: "buyer@example.pl",
  deliveredAt: new Date("2026-03-10T12:00:00Z"),
  lines: [
    { lineRef: "L1", sku: "S1", name: "Shoe", quantity: 3, unitPrice: money(10000), returnable: true },
    { lineRef: "L2", sku: "S2", name: "Gift card", quantity: 1, unitPrice: money(5000), returnable: false },
    { lineRef: "L3", sku: "S3", name: "Sock", quantity: 2, unitPrice: money(5), returnable: true },
  ],
};
const NOW = new Date("2026-03-15T12:00:00Z");
const FEE = { shippingFee: money(1250) };

function input(over: Partial<ReturnQuoteInput> = {}): ReturnQuoteInput {
  return { lines: [{ lineRef: "L1", quantity: 2 }], resolution: "refund", returnMethod: "store", ...over };
}

describe("parseShippingFee", () => {
  it.each([
    [undefined, 0],
    ["", 0],
    ["  ", 0],
    ["0", 0],
    ["12,50", 1250],
    ["12.50", 1250],
    ["8", 800],
  ])("%j -> %i", (raw, minor) => {
    expect(parseShippingFee(raw)).toEqual(money(minor));
  });

  it.each(["abc", "-1", "1,234", "12 zł"])("rejects %j", (raw) => {
    expect(() => parseShippingFee(raw)).toThrow(ConfigurationError);
  });
});

describe("calculateQuote", () => {
  it("refund via store has no fee", () => {
    expect(calculateQuote(ORDER, input(), FEE)).toEqual({ amount: money(20000), fee: money(0) });
  });

  it.each(["parcel_locker", "courier"] as const)("refund via %s subtracts the fee", (returnMethod) => {
    expect(calculateQuote(ORDER, input({ returnMethod }), FEE)).toEqual({ amount: money(18750), fee: money(1250) });
  });

  it("floors the refund at 0 when the fee exceeds the goods", () => {
    const quote = calculateQuote(ORDER, input({ lines: [{ lineRef: "L3", quantity: 1 }], returnMethod: "courier" }), FEE);
    expect(quote).toEqual({ amount: money(0), fee: money(1250) });
  });

  it("store credit adds 10 percent, rounds half-up and takes no fee", () => {
    expect(calculateQuote(ORDER, input({ resolution: "store_credit", returnMethod: "courier" }), FEE)).toEqual({
      amount: money(22000),
      fee: money(0),
    });
    // 5 minor units x 1.10 = 5.5 -> 6
    expect(
      calculateQuote(ORDER, input({ resolution: "store_credit", lines: [{ lineRef: "L3", quantity: 1 }] }), FEE).amount,
    ).toEqual(money(6));
  });

  it("sums several lines", () => {
    const lines = [
      { lineRef: "L1", quantity: 1 },
      { lineRef: "L3", quantity: 2 },
    ];
    expect(calculateQuote(ORDER, input({ lines }), FEE).amount).toEqual(money(10010));
  });

  it("exchange has no amount and no fee", () => {
    expect(calculateQuote(ORDER, input({ resolution: "exchange", returnMethod: "courier" }), FEE)).toEqual({
      amount: null,
      fee: null,
    });
  });

  it("throws for an unknown line", () => {
    expect(() => calculateQuote(ORDER, input({ lines: [{ lineRef: "X", quantity: 1 }] }), FEE)).toThrow(RangeError);
  });
});

describe("toQuoteView", () => {
  it("formats amounts pl-PL", () => {
    const view = toQuoteView(calculateQuote(ORDER, input({ returnMethod: "courier" }), FEE));
    expect(view).toEqual({
      amountMinor: 18750,
      feeMinor: 1250,
      currency: "PLN",
      amountText: "187,50 zł",
      feeText: "12,50 zł",
    });
  });

  it("is all null for exchange", () => {
    expect(toQuoteView(calculateQuote(ORDER, input({ resolution: "exchange" }), FEE))).toEqual({
      amountMinor: null,
      feeMinor: null,
      currency: "PLN",
      amountText: null,
      feeText: null,
    });
  });
});

describe("validateQuoteLines", () => {
  const eligibility = checkEligibility(ORDER, NOW, { windowDays: 30 }, { L1: 1 });

  it("accepts lines within the remaining quantity", () => {
    expect(validateQuoteLines(eligibility, [{ lineRef: "L1", quantity: 2 }])).toEqual({});
  });

  it("reports unknown, not returnable and over-quantity lines per lineRef", () => {
    expect(
      validateQuoteLines(eligibility, [
        { lineRef: "L1", quantity: 3 },
        { lineRef: "L2", quantity: 1 },
        { lineRef: "nope", quantity: 1 },
      ]),
    ).toEqual({ L1: "already_claimed", L2: "not_returnable", nope: "not_returnable" });
  });

  it("reports outside_window and already_claimed lines", () => {
    const late = checkEligibility(ORDER, new Date("2027-01-01T12:00:00Z"), { windowDays: 30 }, {});
    expect(validateQuoteLines(late, [{ lineRef: "L1", quantity: 1 }])).toEqual({ L1: "outside_window" });
    const taken = checkEligibility(ORDER, NOW, { windowDays: 30 }, { L1: 3 });
    expect(validateQuoteLines(taken, [{ lineRef: "L1", quantity: 1 }])).toEqual({ L1: "already_claimed" });
  });

  it("rejects every line of an undelivered order", () => {
    const undelivered = checkEligibility({ ...ORDER, deliveredAt: null }, NOW, { windowDays: 30 }, {});
    expect(validateQuoteLines(undelivered, [{ lineRef: "L1", quantity: 1 }])).toEqual({ L1: "not_returnable" });
  });
});
