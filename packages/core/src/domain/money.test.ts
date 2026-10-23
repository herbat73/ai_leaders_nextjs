import { describe, expect, it } from "vitest";

import { compareMoney, formatMoney, money, multiplyMoney, parseMoney } from "./money";

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
