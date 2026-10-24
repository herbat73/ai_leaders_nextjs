import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

import { AgentSchema } from "../agents/agent.entity";
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
    // Set for decisions made by a signed-in agent; legacy, customer and system events keep it null.
    agent: () => p.manyToOne(AgentSchema).deleteRule("restrict").nullable(),
    createdAt: p.datetime().onCreate(() => new Date()),
  },
});

export type ReturnRequestEventEntity = InferEntity<typeof ReturnRequestEventSchema>;
