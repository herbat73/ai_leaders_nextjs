import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export const ReturnRequestSchema = defineEntity({
  name: "ReturnRequest",
  tableName: "return_requests",
  properties: {
    id: p.integer().primary(),
    rma: p.string().length(32).unique(),
    kind: p.string().length(16).default("return"),
    orderNumber: p.string().length(100),
    customerEmail: p.string().length(320),
    // Nullable since the customer portal: new submissions carry per-item reason codes, legacy rows keep their text.
    reason: p.text().nullable(),
    status: p.string().length(32).default("submitted"),
    decisionNote: p.text().nullable(),
    resolution: p.string().length(16).nullable(),
    resolutionAmount: p.decimal().precision(12).scale(2).nullable(),
    currency: p.string().length(3).columnType("char(3)").default("PLN"),
    exchangeNote: p.text().nullable(),
    returnMethod: p.string().length(24).nullable(),
    idempotencyKey: p.uuid().nullable().unique(),
    createdAt: p.datetime().onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),
  },
  indexes: [{ name: "return_requests_order_number_index", properties: ["orderNumber"] }],
});

export type ReturnRequestEntity = InferEntity<typeof ReturnRequestSchema>;
