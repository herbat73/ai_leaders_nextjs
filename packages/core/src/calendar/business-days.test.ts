import { describe, expect, it } from "vitest";

import { addBusinessDays, dueAt, overdue } from "./business-days";

const iso = (date: Date): string => date.toISOString();

// 2026-11-05 is a Thursday; Warsaw is UTC+1 all that week, so the UTC time of day is unchanged.
describe("dueAt", () => {
  it.each([
    ["Thursday", "2026-11-05T10:00:00.000Z", "2026-11-09T10:00:00.000Z"],
    ["Friday", "2026-11-06T10:00:00.000Z", "2026-11-10T10:00:00.000Z"],
    ["Saturday", "2026-11-07T10:00:00.000Z", "2026-11-10T10:00:00.000Z"],
    ["Sunday", "2026-11-08T10:00:00.000Z", "2026-11-10T10:00:00.000Z"],
    ["Monday", "2026-11-09T10:00:00.000Z", "2026-11-11T10:00:00.000Z"],
  ])("a %s request is due on the second business day, keeping the time of day", (_day, created, due) => {
    expect(iso(dueAt(new Date(created)))).toBe(due);
  });

  it("keeps the Warsaw wall-clock time across the end of daylight saving time", () => {
    // Fri 23 Oct 12:00 Warsaw (UTC+2) → Tue 27 Oct 12:00 Warsaw (UTC+1)
    expect(iso(dueAt(new Date("2026-10-23T10:00:00Z")))).toBe("2026-10-27T11:00:00.000Z");
  });

  it("keeps the Warsaw wall-clock time across the start of daylight saving time", () => {
    // Fri 27 Mar 2026 12:00 Warsaw (UTC+1) → Tue 31 Mar 12:00 Warsaw (UTC+2)
    expect(iso(dueAt(new Date("2026-03-27T11:00:00Z")))).toBe("2026-03-31T10:00:00.000Z");
  });

  it("uses the Warsaw calendar day, not the UTC one, near midnight", () => {
    // Thu 5 Nov 23:30 UTC is already Fri 6 Nov 00:30 in Warsaw → Tue 10 Nov 00:30 Warsaw = Mon 9 Nov 23:30 UTC
    expect(iso(dueAt(new Date("2026-11-05T23:30:00Z")))).toBe("2026-11-09T23:30:00.000Z");
  });
});

describe("addBusinessDays", () => {
  it("returns the same instant for zero days", () => {
    const from = new Date("2026-11-05T10:00:00.250Z");
    expect(iso(addBusinessDays(from, 0))).toBe(iso(from));
  });

  it("keeps milliseconds", () => {
    expect(iso(addBusinessDays(new Date("2026-11-05T10:00:00.250Z"), 1))).toBe("2026-11-06T10:00:00.250Z");
  });

  it("skips a whole weekend for five days", () => {
    expect(iso(addBusinessDays(new Date("2026-11-05T10:00:00Z"), 5))).toBe("2026-11-12T10:00:00.000Z");
  });
});

describe("overdue", () => {
  const due = new Date("2026-11-09T10:00:00Z");

  it("is false at exactly the due instant and true after it", () => {
    expect(overdue("submitted", due, new Date("2026-11-09T10:00:00.000Z"))).toBe(false);
    expect(overdue("submitted", due, new Date("2026-11-09T10:00:00.001Z"))).toBe(true);
  });

  it("is false before the due instant", () => {
    expect(overdue("submitted", due, new Date("2026-11-08T10:00:00Z"))).toBe(false);
  });

  it("is false for any status other than submitted", () => {
    for (const status of ["approved", "rejected", "resolved", "unknown", "requested", ""]) {
      expect(overdue(status, due, new Date("2027-01-01T00:00:00Z"))).toBe(false);
    }
  });
});
