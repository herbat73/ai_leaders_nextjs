import { describe, expect, it } from "vitest";

import { INBOX_PAGE_SIZE, inboxInstantRange, inboxPageCount, normalizeInboxOptions, viewInbox } from "./inbox-view";

const make = (n: number, createdAt = "2026-10-20T10:00:00Z") => ({ rma: `RMA-2026-${String(n).padStart(5, "0")}`, createdAt: new Date(createdAt) });
const items = Array.from({ length: 25 }, (_, i) => make(i + 1));

describe("viewInbox", () => {
  it("cuts pages of ten and clamps the page", () => {
    expect(viewInbox(items, {}).rows).toHaveLength(INBOX_PAGE_SIZE);
    const last = viewInbox(items, { page: 99 });
    expect(last).toMatchObject({ page: 3, pageCount: 3, total: 25 });
    expect(last.rows).toHaveLength(5);
    expect(viewInbox(items, { page: Number.NaN }).page).toBe(1);
  });

  it("searches a part of the RMA number", () => {
    const view = viewInbox(items, { search: " 00012 " });
    expect(view.rows.map((r) => r.rma)).toEqual(["RMA-2026-00012"]);
    expect(viewInbox(items, { search: "rma-2026-0002" }).total).toBe(6);
  });

  it("filters by an inclusive Warsaw day range and ignores malformed dates", () => {
    // 2026-10-24T22:30Z is already 25 Oct in Warsaw.
    const data = [make(1, "2026-10-24T22:30:00Z"), make(2, "2026-10-24T10:00:00Z"), make(3, "2026-10-26T10:00:00Z")];
    expect(viewInbox(data, { from: "2026-10-25", to: "2026-10-25" }).rows.map((r) => r.rma)).toEqual(["RMA-2026-00001"]);
    expect(viewInbox(data, { from: "2026-10-25" }).total).toBe(2);
    expect(viewInbox(data, { to: "2026-10-24" }).total).toBe(1);
    expect(viewInbox(data, { from: "nonsense" }).total).toBe(3);
  });

  it("filters by status, alone and combined with search and dates, and leaves rows alone when absent", () => {
    const data = [
      { ...make(1, "2026-10-20T10:00:00Z"), status: "submitted" as const },
      { ...make(2, "2026-10-21T10:00:00Z"), status: "resolved" as const },
      { ...make(12, "2026-10-22T10:00:00Z"), status: "resolved" as const },
    ];
    expect(viewInbox(data, { status: "resolved" }).rows.map((r) => r.rma)).toEqual(["RMA-2026-00002", "RMA-2026-00012"]);
    expect(viewInbox(data, { status: "resolved", search: "12" }).total).toBe(1);
    expect(viewInbox(data, { status: "resolved", from: "2026-10-22" }).total).toBe(1);
    expect(viewInbox(data, { status: "cancelled" }).total).toBe(0);
    expect(viewInbox(data, {}).total).toBe(3);
  });
});

describe("normalizeInboxOptions", () => {
  it("trims and lower-cases the search and drops a blank one", () => {
    expect(normalizeInboxOptions({ search: "  RMA-2026-0001 " }).search).toBe("rma-2026-0001");
    expect(normalizeInboxOptions({ search: "   " })).not.toHaveProperty("search");
  });

  it("keeps well-formed dates and drops malformed ones", () => {
    expect(normalizeInboxOptions({ from: "2026-10-25", to: "2026-10-26" })).toMatchObject({ from: "2026-10-25", to: "2026-10-26" });
    const bad = normalizeInboxOptions({ from: "25.10.2026", to: "x" });
    expect(bad).not.toHaveProperty("from");
    expect(bad).not.toHaveProperty("to");
  });

  it("turns a missing, non-numeric, zero or negative page into 1 and truncates a fraction", () => {
    for (const page of [undefined, Number.NaN, 0, -3]) expect(normalizeInboxOptions({ page }).page).toBe(1);
    expect(normalizeInboxOptions({ page: 2.9 }).page).toBe(2);
  });

  it("carries the status only when given", () => {
    expect(normalizeInboxOptions({ status: "resolved" }).status).toBe("resolved");
    expect(normalizeInboxOptions({})).not.toHaveProperty("status");
  });
});

describe("inboxPageCount", () => {
  it("is at least 1 and rounds up", () => {
    expect(inboxPageCount(0)).toBe(1);
    expect(inboxPageCount(10)).toBe(1);
    expect(inboxPageCount(11)).toBe(2);
    expect(inboxPageCount(25, 5)).toBe(5);
  });
});

describe("inboxInstantRange", () => {
  it("bounds an inclusive Warsaw-day range by the first instant of the day and of the day after", () => {
    // 25 Oct 2026 is the day Warsaw leaves summer time: it has 25 hours and the day after starts at +01:00.
    const range = inboxInstantRange({ from: "2026-10-25", to: "2026-10-25" });
    expect(range.start?.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(range.endExclusive?.toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });

  it("keeps the same instants as the in-memory day check at both edges", () => {
    const { start, endExclusive } = inboxInstantRange({ from: "2026-03-29", to: "2026-03-29" });
    const inDay = (iso: string) => viewInbox([make(1, iso)], { from: "2026-03-29", to: "2026-03-29" }).total === 1;
    const justBefore = new Date((start as Date).getTime() - 1).toISOString();
    const justBeforeEnd = new Date((endExclusive as Date).getTime() - 1).toISOString();
    expect([inDay(justBefore), inDay((start as Date).toISOString()), inDay(justBeforeEnd), inDay((endExclusive as Date).toISOString())]).toEqual([false, true, true, false]);
  });

  it("leaves out a missing or malformed bound", () => {
    expect(inboxInstantRange({})).toEqual({});
    expect(inboxInstantRange({ from: "x", to: "2026/10/25" })).toEqual({});
    expect(inboxInstantRange({ to: "2026-10-25" }).start).toBeUndefined();
  });
});
