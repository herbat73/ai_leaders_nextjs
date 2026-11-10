import { describe, expect, it } from "vitest";

import { INBOX_PAGE_SIZE } from "../returns/inbox-view";
import { viewSupplierClaims } from "./claim-view";

interface Row {
  id: number;
  ref: string;
  rma: string;
  supplierName: string;
  createdAt: Date;
}

const make = (n: number, overrides: Partial<Row> = {}): Row => ({
  id: n,
  ref: `SC-2026-${String(n).padStart(5, "0")}`,
  rma: `RMA-2026-${String(100 + n).padStart(5, "0")}`,
  supplierName: n % 2 === 0 ? `Alfa Hurt ${n}` : `Beta Import ${n}`,
  createdAt: new Date(Date.UTC(2026, 9, n, 10)),
  ...overrides,
});
const items = Array.from({ length: 25 }, (_, i) => make(i + 1));

describe("viewSupplierClaims", () => {
  it("cuts pages of ten and keeps the input order", () => {
    const first = viewSupplierClaims(items, {});
    expect(first.rows).toHaveLength(INBOX_PAGE_SIZE);
    expect(first.rows.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(viewSupplierClaims(items, { page: 3 }).rows).toHaveLength(5);
  });

  it("clamps the page: low, negative, non-numeric and too high", () => {
    expect(viewSupplierClaims(items, { page: 0 }).page).toBe(1);
    expect(viewSupplierClaims(items, { page: -4 }).page).toBe(1);
    expect(viewSupplierClaims(items, { page: Number.NaN }).page).toBe(1);
    expect(viewSupplierClaims(items, { page: 99 })).toMatchObject({ page: 3, pageCount: 3, total: 25 });
  });

  it("gives one empty page for no input", () => {
    expect(viewSupplierClaims([], {})).toEqual({ rows: [], total: 0, page: 1, pageCount: 1 });
  });

  it("matches the number against the claim reference", () => {
    expect(viewSupplierClaims(items, { q: "sc-2026-00007" }).rows.map((r) => r.id)).toEqual([7]);
  });

  it("matches the number against the RMA", () => {
    expect(viewSupplierClaims(items, { q: "  rma-2026-00112 " }).rows.map((r) => r.id)).toEqual([12]);
  });

  it("matches a part of the number, ignoring case", () => {
    expect(viewSupplierClaims(items, { q: "-0002" }).rows.map((r) => r.id)).toEqual([20, 21, 22, 23, 24, 25]);
  });

  it("searches a part of the supplier name", () => {
    expect(viewSupplierClaims(items, { supplier: "ALFA" }).total).toBe(12);
    expect(viewSupplierClaims(items, { supplier: "hurt 4" }).rows.map((r) => r.id)).toEqual([4]);
  });

  it("combines number and supplier with AND", () => {
    expect(viewSupplierClaims(items, { q: "sc-2026-0001", supplier: "beta" }).rows.map((r) => r.id)).toEqual([11, 13, 15, 17, 19]);
  });

  it("ignores blank text", () => {
    expect(viewSupplierClaims(items, { q: "   ", supplier: "" }).total).toBe(25);
  });

  it("filters by creation day, inclusive, from only, to only and both", () => {
    expect(viewSupplierClaims(items, { from: "2026-10-20" }).total).toBe(6);
    expect(viewSupplierClaims(items, { to: "2026-10-03" }).rows.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(viewSupplierClaims(items, { from: "2026-10-05", to: "2026-10-07" }).rows.map((r) => r.id)).toEqual([5, 6, 7]);
  });

  it("ignores malformed dates and returns nothing for from after to", () => {
    expect(viewSupplierClaims(items, { from: "20.10.2026", to: "x" }).total).toBe(25);
    expect(viewSupplierClaims(items, { from: "2026-10-09", to: "2026-10-02" }).total).toBe(0);
  });

  it("reads the day in Europe/Warsaw across the October clock change", () => {
    // 2026-10-24 22:30 UTC is 00:30 on the 25th in Warsaw (CEST); 2026-10-25 22:30 UTC is 23:30 on the 25th (CET).
    const edge = [make(1, { createdAt: new Date("2026-10-24T22:30:00Z") }), make(2, { createdAt: new Date("2026-10-25T22:30:00Z") })];
    expect(viewSupplierClaims(edge, { from: "2026-10-25", to: "2026-10-25" }).rows.map((r) => r.id)).toEqual([1, 2]);
    expect(viewSupplierClaims(edge, { to: "2026-10-24" }).total).toBe(0);
  });
});
