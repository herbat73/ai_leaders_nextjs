import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

import { ReturnRequestSchema } from "./return-request.entity";

/** Name and price are a snapshot for display and audit; the order platform stays the source of truth. */
export const ReturnRequestItemSchema = defineEntity({
  name: "ReturnRequestItem",
  tableName: "return_request_items",
  properties: {
    id: p.integer().primary(),
    returnRequest: () => p.manyToOne(ReturnRequestSchema).deleteRule("restrict"),
    lineRef: p.string().length(100),
    sku: p.string().length(100),
    name: p.string().length(255),
    quantity: p.integer(),
    unitPrice: p.decimal().precision(12).scale(2),
    reasonCode: p.string().length(32),
    comment: p.text().nullable(),
  },
  indexes: [{ name: "return_request_items_line_ref_index", properties: ["lineRef"] }],
  uniques: [{ name: "return_request_items_return_request_id_line_ref_unique", properties: ["returnRequest", "lineRef"] }],
});

export type ReturnRequestItemEntity = InferEntity<typeof ReturnRequestItemSchema>;
