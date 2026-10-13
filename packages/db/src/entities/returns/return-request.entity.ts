import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export const ReturnRequestSchema = defineEntity({
  name: "ReturnRequest",
  tableName: "return_requests",
  properties: {
    id: p.integer().primary(),
    orderNumber: p.string().length(100),
    customerEmail: p.string().length(320),
    reason: p.text(),
    status: p.string().length(32).default("requested"),
    createdAt: p.datetime().onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),
  },
});

export type ReturnRequestEntity = InferEntity<typeof ReturnRequestSchema>;
