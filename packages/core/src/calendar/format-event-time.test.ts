import { describe, expect, it } from "vitest";

import { formatEventTime } from "./format-event-time";

describe("formatEventTime", () => {
  it("formats in pl-PL and Europe/Warsaw time", () => {
    expect(formatEventTime(new Date("2026-10-23T10:05:00Z"))).toBe("23.10.2026, 12:05");
    expect(formatEventTime(new Date("2026-11-05T10:05:00Z"))).toBe("05.11.2026, 11:05");
  });

  it("uses 24-hour time around midnight", () => {
    expect(formatEventTime(new Date("2026-12-31T23:30:00Z"))).toBe("01.01.2027, 00:30");
  });
});
