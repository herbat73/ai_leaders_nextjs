import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export const SupplierSchema = defineEntity({
  name: "Supplier",
  tableName: "suppliers",
  properties: {
    id: p.integer().primary(),
    // Unique case-insensitively through a functional index created by the migration (an entity cannot express it).
    name: p.string().length(120),
    // Stored trimmed and lower-cased; where claims are sent. Personal data of a company contact, never logged.
    email: p.string().length(254),
    guidelines: p.text().nullable(),
    active: p.boolean().default(true),
    createdAt: p.datetime().onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),
  },
});

export type SupplierEntity = InferEntity<typeof SupplierSchema>;
