import { describe, expect, it } from "vitest";

import { formatRma } from "./rma";

describe("formatRma", () => {
  const created = new Date("2026-10-22T10:00:00Z");

  it("pads the sequence to five digits", () => {
    expect(formatRma(7, created)).toBe("RMA-2026-00007");
    expect(formatRma(99999, created)).toBe("RMA-2026-99999");
  });

  it("grows beyond five digits instead of truncating", () => {
    expect(formatRma(100000, created)).toBe("RMA-2026-100000");
    expect(formatRma(1234567, created)).toBe("RMA-2026-1234567");
  });

  it("takes the year in Europe/Warsaw, so 31 Dec 23:30 UTC already belongs to the next year", () => {
    expect(formatRma(1, new Date("2026-12-31T22:59:59Z"))).toBe("RMA-2026-00001");
    expect(formatRma(1, new Date("2026-12-31T23:30:00Z"))).toBe("RMA-2027-00001");
  });

  it("rejects a sequence that is not a positive integer", () => {
    for (const bad of [0, -1, 1.5, Number.NaN]) expect(() => formatRma(bad, created)).toThrow(RangeError);
  });
});
