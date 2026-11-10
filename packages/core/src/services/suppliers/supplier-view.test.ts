import { describe, expect, it } from "vitest";

import { INBOX_PAGE_SIZE } from "../returns/inbox-view";
import { viewSuppliers } from "./supplier-view";
import type { Supplier } from "./types";

const make = (n: number, overrides: Partial<Supplier> = {}): Supplier => ({
  id: n,
  name: `Dostawca ${String(n).padStart(2, "0")}`,
  email: `kontakt${n}@firma${n}.pl`,
  guidelines: null,
  active: true,
  createdAt: new Date("2026-10-20T10:00:00Z"),
  updatedAt: new Date("2026-10-20T10:00:00Z"),
  ...overrides,
});
const items = Array.from({ length: 25 }, (_, i) => make(i + 1, { active: i % 5 !== 0 }));

describe("viewSuppliers", () => {
  it("cuts pages of ten and keeps the input order", () => {
    const first = viewSuppliers(items, {});
    expect(first.rows).toHaveLength(INBOX_PAGE_SIZE);
    expect(first.rows.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(viewSuppliers(items, { page: 3 }).rows).toHaveLength(5);
  });

  it("clamps the page: low, negative, non-numeric and too high", () => {
    expect(viewSuppliers(items, { page: 0 }).page).toBe(1);
    expect(viewSuppliers(items, { page: -4 }).page).toBe(1);
    expect(viewSuppliers(items, { page: Number.NaN }).page).toBe(1);
    expect(viewSuppliers(items, { page: 99 })).toMatchObject({ page: 3, pageCount: 3, total: 25 });
  });

  it("filters by status", () => {
    expect(viewSuppliers(items, { status: "inactive" }).rows.map((s) => s.id)).toEqual([1, 6, 11, 16, 21]);
    expect(viewSuppliers(items, { status: "active" }).total).toBe(20);
  });

  it("searches a part of the name, ignoring case and surrounding blanks", () => {
    expect(viewSuppliers(items, { name: "  DOSTAWCA 07 " }).rows.map((s) => s.id)).toEqual([7]);
    expect(viewSuppliers(items, { name: "dostawca 1" }).total).toBe(10);
  });

  it("searches a part of the e-mail, ignoring case", () => {
    expect(viewSuppliers(items, { email: "@FIRMA12.pl" }).rows.map((s) => s.id)).toEqual([12]);
    expect(viewSuppliers(items, { email: "kontakt2" }).total).toBe(7);
  });

  it("requires every filled field to match", () => {
    expect(viewSuppliers(items, { name: "dostawca 1", email: "firma12", status: "active" }).rows.map((s) => s.id)).toEqual([12]);
    expect(viewSuppliers(items, { name: "dostawca 12", email: "firma13" }).total).toBe(0);
    expect(viewSuppliers(items, { name: "dostawca 11", status: "inactive" }).rows.map((s) => s.id)).toEqual([11]);
  });

  it("ignores blank text and keeps everything", () => {
    expect(viewSuppliers(items, { name: "   ", email: "" }).total).toBe(25);
  });

  it("returns page 1 of 1 for an empty result and for an empty list", () => {
    expect(viewSuppliers(items, { name: "nie ma takiego" })).toEqual({ rows: [], total: 0, page: 1, pageCount: 1 });
    expect(viewSuppliers([], { page: 5 })).toEqual({ rows: [], total: 0, page: 1, pageCount: 1 });
  });

  it("does not choke on a very long filter value", () => {
    expect(viewSuppliers(items, { name: "x".repeat(10_000) }).total).toBe(0);
  });
});
