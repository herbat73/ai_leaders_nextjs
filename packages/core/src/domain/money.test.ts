import { describe, expect, it } from "vitest";

import { addMoney, applyRate, compareMoney, formatMoney, money, multiplyMoney, parseMoney } from "./money";

describe("parseMoney", () => {
  it.each([
    ["149,99", 14999],
    ["149.99", 14999],
    ["1 299,00", 129900],
    ["1 299,00", 129900],
    ["60", 6000],
    ["0,5", 50],
    ["0", 0],
  ])("parses %j", (input, minor) => {
    expect(parseMoney(input)).toEqual({ amountMinor: minor, currency: "PLN" });
  });

  it.each(["-1", "1,234", "abc", "", "1,2,3", "12 zł", "9007199254740993"])("rejects %j", (input) => {
    expect(parseMoney(input)).toBeNull();
  });

  it("rejects an amount whose minor units are not a safe integer", () => {
    expect(parseMoney("90071992547409,99")).toBeNull();
  });
});

describe("compareMoney", () => {
  it("orders amounts", () => {
    expect(compareMoney(money(1), money(2))).toBeLessThan(0);
    expect(compareMoney(money(2), money(2))).toBe(0);
    expect(compareMoney(money(3), money(2))).toBeGreaterThan(0);
  });
});

describe("multiplyMoney", () => {
  it("multiplies by quantity 0 and 3", () => {
    expect(multiplyMoney(money(1050), 0).amountMinor).toBe(0);
    expect(multiplyMoney(money(1050), 3).amountMinor).toBe(3150);
  });

  it.each([-1, 1.5, Number.NaN])("rejects quantity %j", (quantity) => {
    expect(() => multiplyMoney(money(100), quantity)).toThrow(RangeError);
  });

  it("rejects safe-integer overflow", () => {
    expect(() => multiplyMoney(money(Number.MAX_SAFE_INTEGER), 2)).toThrow(RangeError);
  });
});

describe("formatMoney", () => {
  it("pins pl-PL strings including the non-breaking spaces", () => {
    expect(formatMoney(money(14999))).toBe("149,99 zł");
    expect(formatMoney(money(129900))).toBe("1 299,00 zł");
    expect(formatMoney(money(123456789))).toBe("1 234 567,89 zł");
    expect(formatMoney(money(5))).toBe("0,05 zł");
  });
});

describe("addMoney", () => {
  it("adds amounts of one currency", () => {
    expect(addMoney(money(150), money(275))).toEqual(money(425));
  });

  it("throws beyond the safe integers", () => {
    expect(() => addMoney(money(Number.MAX_SAFE_INTEGER), money(1))).toThrow(RangeError);
  });

  it("throws on a currency mismatch", () => {
    expect(() => addMoney(money(1), { amountMinor: 1, currency: "EUR" as "PLN" })).toThrow(RangeError);
  });
});

describe("applyRate", () => {
  it("applies +10 % exactly", () => {
    expect(applyRate(money(10000), 11000)).toEqual(money(11000));
    expect(applyRate(money(0), 11000)).toEqual(money(0));
  });

  it("rounds 0.5 minor units up", () => {
    expect(applyRate(money(5), 11000)).toEqual(money(6)); // 5.5 -> 6
    expect(applyRate(money(15), 11000)).toEqual(money(17)); // 16.5 -> 17
    expect(applyRate(money(1), 5000)).toEqual(money(1)); // 0.5 -> 1
  });

  it("rounds below 0.5 down", () => {
    expect(applyRate(money(1), 4999)).toEqual(money(0));
    expect(applyRate(money(14), 11000)).toEqual(money(15)); // 15.4 -> 15
  });

  it("has no float drift on large amounts", () => {
    expect(applyRate(money(123456789012), 11000)).toEqual(money(135802467913)); // 135802467913.2
  });

  it("rejects bad input", () => {
    expect(() => applyRate(money(-1), 11000)).toThrow(RangeError);
    expect(() => applyRate(money(1), 1.5)).toThrow(RangeError);
    expect(() => applyRate(money(1), -1)).toThrow(RangeError);
    expect(() => applyRate(money(Number.MAX_SAFE_INTEGER), 20000)).toThrow(RangeError);
  });
});
