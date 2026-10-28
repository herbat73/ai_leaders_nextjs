import { describe, expect, it } from "vitest";

import { INBOX_PAGE_SIZE, viewInbox } from "./inbox-view";

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
});
