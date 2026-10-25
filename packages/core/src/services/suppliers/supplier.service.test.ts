import { describe, expect, it } from "vitest";

import { ConflictError, NotFoundError } from "../../errors";
import { supplierCreateSchema, supplierUpdateSchema } from "../../validators/suppliers/supplier.schema";
import { SupplierService } from "./supplier.service";
import type { Supplier, SupplierRepository } from "./types";

const NOW = new Date("2026-11-05T10:00:00Z");

function fakeRepository(): SupplierRepository & { rows: Supplier[] } {
  const rows: Supplier[] = [];
  return {
    rows,
    list: async () => [...rows].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
    findById: async (id) => rows.find((row) => row.id === id) ?? null,
    create: async (input) => {
      if (rows.some((row) => row.name.toLowerCase() === input.name.toLowerCase())) throw new ConflictError("exists");
      const row: Supplier = { id: rows.length + 1, active: true, createdAt: NOW, updatedAt: NOW, ...input };
      rows.push(row);
      return row;
    },
    update: async (id, changes) => {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) return null;
      Object.assign(row, changes);
      return row;
    },
  };
}

describe("SupplierService", () => {
  it("creates, lists active suppliers first and updates", async () => {
    const service = new SupplierService({ supplierRepository: fakeRepository() });
    const zeta = await service.create({ name: "Zeta", email: "z@example.pl", guidelines: null });
    await service.create({ name: "Alfa", email: "a@example.pl", guidelines: "Wideo wymagane" });
    await service.update(zeta.id, { active: true, guidelines: "x" });
    await service.update(2, { active: false });
    expect((await service.list()).map((s) => s.name)).toEqual(["Zeta", "Alfa"]);
  });

  it("answers 404 for an unknown supplier", async () => {
    const service = new SupplierService({ supplierRepository: fakeRepository() });
    await expect(service.get(9)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.update(9, { active: false })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("passes a duplicate name through as a conflict", async () => {
    const service = new SupplierService({ supplierRepository: fakeRepository() });
    await service.create({ name: "Alfa", email: "a@example.pl", guidelines: null });
    await expect(service.create({ name: "ALFA", email: "b@example.pl", guidelines: null })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("supplier schemas", () => {
  it("normalises the e-mail and empty guidelines on create", () => {
    expect(supplierCreateSchema.parse({ name: "  Alfa ", email: " A@Example.PL ", guidelines: "   " })).toEqual({
      name: "Alfa",
      email: "a@example.pl",
      guidelines: null,
    });
    expect(supplierCreateSchema.parse({ name: "Alfa", email: "a@example.pl" }).guidelines).toBeNull();
  });

  it.each([
    ["a blank name", { name: " ", email: "a@example.pl" }],
    ["a bad e-mail", { name: "Alfa", email: "nope" }],
    ["long guidelines", { name: "Alfa", email: "a@example.pl", guidelines: "x".repeat(2001) }],
  ])("rejects %s", (_name, body) => {
    expect(supplierCreateSchema.safeParse(body).success).toBe(false);
  });

  it("needs at least one field on update and lets guidelines be cleared", () => {
    expect(supplierUpdateSchema.safeParse({}).success).toBe(false);
    expect(supplierUpdateSchema.parse({ guidelines: "" })).toEqual({ guidelines: null });
    expect(supplierUpdateSchema.parse({ active: false })).toEqual({ active: false });
  });
});
