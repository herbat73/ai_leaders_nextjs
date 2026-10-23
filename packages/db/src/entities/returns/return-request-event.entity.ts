import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

import { ReturnRequestSchema } from "./return-request.entity";

export const ReturnRequestEventSchema = defineEntity({
  name: "ReturnRequestEvent",
  tableName: "return_request_events",
  properties: {
    id: p.integer().primary(),
    returnRequest: () => p.manyToOne(ReturnRequestSchema).deleteRule("restrict"),
    type: p.string().length(32),
    fromStatus: p.string().length(32).nullable(),
    toStatus: p.string().length(32),
    note: p.text().nullable(),
    actor: p.string().length(16),
    createdAt: p.datetime().onCreate(() => new Date()),
  },
});

export type ReturnRequestEventEntity = InferEntity<typeof ReturnRequestEventSchema>;
