import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

import { AgentSchema } from "../agents/agent.entity";
import { ReturnRequestSchema } from "../returns/return-request.entity";
import { SupplierSchema } from "../suppliers/supplier.entity";

export const SupplierClaimSchema = defineEntity({
  name: "SupplierClaim",
  tableName: "supplier_claims",
  properties: {
    id: p.integer().primary(),
    ref: p.string().length(32).unique(),
    // One claim per complaint (unique), so a retry or a second agent cannot send the vendor the same case twice.
    returnRequest: () => p.manyToOne(ReturnRequestSchema).deleteRule("restrict").unique(),
    supplier: () => p.manyToOne(SupplierSchema).deleteRule("restrict"),
    // `draft` | `sent` | `accepted` | `rejected` | `credited`, validated in code like the other statuses.
    status: p.string().length(16).default("draft"),
    subject: p.text(),
    body: p.text(),
    createdByAgent: () => p.manyToOne(AgentSchema).deleteRule("restrict"),
    sentAt: p.datetime().nullable(),
    answeredAt: p.datetime().nullable(),
    creditAmount: p.decimal().precision(12).scale(2).nullable(),
    currency: p.string().length(3).columnType("char(3)").default("PLN"),
    answerNote: p.text().nullable(),
    creditedAt: p.datetime().nullable(),
    createdAt: p.datetime().onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),
  },
});

export type SupplierClaimEntity = InferEntity<typeof SupplierClaimSchema>;
