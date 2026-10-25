import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

import { AgentSchema } from "../agents/agent.entity";
import { SupplierClaimSchema } from "./supplier-claim.entity";

export const SupplierClaimEventSchema = defineEntity({
  name: "SupplierClaimEvent",
  tableName: "supplier_claim_events",
  properties: {
    id: p.integer().primary(),
    supplierClaim: () => p.manyToOne(SupplierClaimSchema).deleteRule("restrict"),
    type: p.string().length(32),
    fromStatus: p.string().length(16).nullable(),
    toStatus: p.string().length(16),
    note: p.text().nullable(),
    agent: () => p.manyToOne(AgentSchema).deleteRule("restrict").nullable(),
    createdAt: p.datetime().onCreate(() => new Date()),
  },
});

export type SupplierClaimEventEntity = InferEntity<typeof SupplierClaimEventSchema>;
