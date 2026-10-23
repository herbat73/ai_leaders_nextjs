import { describe, expect, it } from "vitest";

import { formatDatePl, formatDateShortPl } from "./format-date-pl";

describe("formatDatePl", () => {
  it("formats a plain date with the genitive month", () => {
    expect(formatDatePl(new Date("2026-10-23T10:00:00Z"))).toBe(
      "23 października 2026",
    );
    expect(formatDatePl(new Date("2026-01-05T10:00:00Z"))).toBe(
      "5 stycznia 2026",
    );
    expect(formatDatePl(new Date("2026-09-01T10:00:00Z"))).toBe(
      "1 września 2026",
    );
  });

  it("is correct on the spring DST change day (2026-03-29)", () => {
    expect(formatDatePl(new Date("2026-03-29T00:30:00Z"))).toBe(
      "29 marca 2026",
    );
    expect(formatDatePl(new Date("2026-03-29T22:30:00Z"))).toBe(
      "30 marca 2026",
    );
  });

  it("is correct on the autumn DST change day (2026-10-25)", () => {
    expect(formatDatePl(new Date("2026-10-24T22:30:00Z"))).toBe(
      "25 października 2026",
    );
    expect(formatDatePl(new Date("2026-10-25T22:30:00Z"))).toBe(
      "25 października 2026",
    );
    expect(formatDatePl(new Date("2026-10-25T23:30:00Z"))).toBe(
      "26 października 2026",
    );
  });

  it("uses the Warsaw day when the UTC instant is still the previous day", () => {
    expect(formatDatePl(new Date("2026-12-31T23:30:00Z"))).toBe(
      "1 stycznia 2027",
    );
  });
});

describe("formatDateShortPl", () => {
  it("pads day and month and reads Warsaw time", () => {
    expect(formatDateShortPl(new Date("2026-03-05T10:00:00Z"))).toBe(
      "05.03.2026",
    );
    expect(formatDateShortPl(new Date("2026-12-31T23:30:00Z"))).toBe(
      "01.01.2027",
    );
  });
});
