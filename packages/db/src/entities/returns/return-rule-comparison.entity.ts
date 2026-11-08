import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

import { AgentSchema } from "../agents/agent.entity";
import { ReturnRequestSchema } from "./return-request.entity";

/** What the rules engine recommended at the moment an agent approved or rejected a request, and the agent's choice. */
export const ReturnRuleComparisonSchema = defineEntity({
  name: "ReturnRuleComparison",
  tableName: "return_rule_comparisons",
  properties: {
    id: p.integer().primary(),
    returnRequest: () => p.manyToOne(ReturnRequestSchema).deleteRule("restrict"),
    agent: () => p.manyToOne(AgentSchema).deleteRule("restrict"),
    recommended: p.string().length(16),
    // Comma-joined ids of the rules behind the recommendation ("R08", "R08,R10c"); empty when there is none.
    ruleIds: p.text().default(""),
    actualStatus: p.string().length(32),
    // `null` when nothing was recommended.
    followed: p.boolean().nullable(),
    createdAt: p.datetime().onCreate(() => new Date()),
  },
});

export type ReturnRuleComparisonEntity = InferEntity<typeof ReturnRuleComparisonSchema>;
