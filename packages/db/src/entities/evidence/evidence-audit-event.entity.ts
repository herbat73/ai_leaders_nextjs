import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

import { AgentSchema } from "../agents/agent.entity";

/**
 * One row per audited action on an evidence photo (added, removed, downloaded by an agent). `evidenceFileId` and
 * `returnRequestId` are plain columns without foreign keys, so the trail outlives a deleted file or request. Rows are
 * only inserted, except that attaching a file sets `returnRequestId` on its rows.
 */
export const EvidenceAuditEventSchema = defineEntity({
  name: "EvidenceAuditEvent",
  tableName: "evidence_audit_events",
  properties: {
    id: p.integer().primary(),
    evidenceFileId: p.uuid(),
    orderNumber: p.string().length(100),
    returnRequestId: p.integer().nullable(),
    action: p.string().length(16),
    actor: p.string().length(16),
    agent: () => p.manyToOne(AgentSchema).deleteRule("restrict").nullable(),
    createdAt: p.datetime().onCreate(() => new Date()),
  },
  indexes: [
    { name: "evidence_audit_events_evidence_file_id_index", properties: ["evidenceFileId"] },
    { name: "evidence_audit_events_return_request_id_index", properties: ["returnRequestId"] },
  ],
});

export type EvidenceAuditEventEntity = InferEntity<typeof EvidenceAuditEventSchema>;
