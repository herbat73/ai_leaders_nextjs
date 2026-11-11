import { TransactionPropagation } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import { randomUUID } from "node:crypto";
import {
  EVIDENCE_AUDIT_ACTIONS,
  EVIDENCE_CONTENT_TYPES,
  type AttachOutcome,
  type EvidenceContent,
  type EvidenceAuditEntry,
  type EvidenceFile,
  type EvidenceLimits,
  type EvidencePort,
  type NewEvidenceDownload,
  type NewEvidenceFile,
  type StageOutcome,
} from "@easyrms/core";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLUMNS = `"id", "order_number", "return_request_id", "content_type", "byte_size", "sha256", "label", "created_at"`;

interface Row {
  id: string;
  order_number: string;
  return_request_id: number | null;
  content_type: string;
  byte_size: number;
  sha256: string;
  label: string;
  created_at: Date | string;
}

function toFile(row: Row): EvidenceFile {
  const contentType = EVIDENCE_CONTENT_TYPES.find((candidate) => candidate === row.content_type);
  return {
    id: row.id,
    orderNumber: row.order_number,
    returnRequestId: row.return_request_id,
    // Written only by this repository from the domain union; an unknown stored value reads as the safest type.
    contentType: contentType ?? "image/jpeg",
    byteSize: Number(row.byte_size),
    sha256: row.sha256,
    label: row.label,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

/** The same per-order advisory lock the return repository takes, so uploads and submits of one order queue. */
async function lockOrder(tx: EntityManager, orderNumber: string): Promise<void> {
  // Raw SQL: MikroORM has no advisory-lock API; the order number is a bound parameter, never concatenated.
  await tx.execute("select pg_advisory_xact_lock(hashtext(?))", [orderNumber]);
}

const joinOrOpen = (): { propagation: TransactionPropagation } => ({ propagation: TransactionPropagation.REQUIRED });

/** Writes one audit row on the caller's transaction (`tx`), so it commits or rolls back with the change it records. */
async function audit(
  tx: EntityManager,
  row: { fileId: string; orderNumber: string; action: "added" | "removed"; actor: "guest" },
): Promise<void> {
  await tx.execute(
    `insert into "evidence_audit_events" ("evidence_file_id", "order_number", "action", "actor", "created_at") values (?, ?, ?, ?, now())`,
    [row.fileId, row.orderNumber, row.action, row.actor],
  );
}

/** Rolls the transaction back from inside; caught by the method that threw it. */
class Rollback extends Error {}

export class MikroOrmEvidenceRepository implements EvidencePort {
  private readonly em: EntityManager;

  constructor({ em }: { em: EntityManager }) {
    this.em = em;
  }

  async stage(
    input: NewEvidenceFile,
    limits: Pick<EvidenceLimits, "maxFilesPerRequest" | "maxBytesPerOrder">,
    staleBefore: Date,
  ): Promise<StageOutcome> {
    return this.em.transactional(async (tx) => {
      await lockOrder(tx, input.orderNumber);
      // Orphans: staged files nobody attached within the guest session can no longer be attached by anyone.
      await tx.execute(`delete from "evidence_files" where "order_number" = ? and "return_request_id" is null and "created_at" < ?`, [
        input.orderNumber,
        staleBefore,
      ]);
      const id = randomUUID();
      // Count, bytes and insert in one statement under the lock, so two tabs of one order cannot both pass the check.
      const inserted = await tx.execute<Row[]>(
        `insert into "evidence_files" ("id", "order_number", "content_type", "byte_size", "sha256", "label", "data", "created_at")
         select ?, ?, ?, ?, ?, ?, ?, now()
         where (select count(*) from "evidence_files" where "order_number" = ? and "return_request_id" is null) < ?
           and (select coalesce(sum("byte_size"), 0) from "evidence_files" where "order_number" = ?) + ? <= ?
         returning ${COLUMNS}`,
        [
          id,
          input.orderNumber,
          input.contentType,
          input.data.byteLength,
          input.sha256,
          input.label,
          Buffer.from(input.data),
          input.orderNumber,
          limits.maxFilesPerRequest,
          input.orderNumber,
          input.data.byteLength,
          limits.maxBytesPerOrder,
        ],
      );
      const row = inserted[0];
      if (row) {
        // Same transaction as the file: if the audit row cannot be written the upload is rolled back (fail closed).
        await audit(tx, { fileId: row.id, orderNumber: input.orderNumber, action: "added", actor: "guest" });
        return { result: "stored" as const, file: toFile(row) };
      }
      const [{ count }] = await tx.execute<{ count: string }[]>(
        `select count(*) as "count" from "evidence_files" where "order_number" = ? and "return_request_id" is null`,
        [input.orderNumber],
      );
      return Number(count) >= limits.maxFilesPerRequest ? { result: "too_many_files" as const } : { result: "quota_exceeded" as const };
    }, joinOrOpen());
  }

  async find(id: string): Promise<EvidenceContent | null> {
    if (!UUID_PATTERN.test(id)) return null;
    const rows = await this.em.execute<(Row & { data: Buffer })[]>(`select ${COLUMNS}, "data" from "evidence_files" where "id" = ?`, [id]);
    const row = rows[0];
    return row ? { file: toFile(row), data: new Uint8Array(row.data) } : null;
  }

  async attach(orderNumber: string, ids: readonly string[], returnRequestId: number): Promise<AttachOutcome> {
    const unique = [...new Set(ids.map((id) => id.toLowerCase()))];
    if (unique.some((id) => !UUID_PATTERN.test(id))) return { result: "invalid" };
    if (unique.length === 0) return { result: "attached", files: [] };
    try {
      return await this.em.transactional(async (tx) => {
        await lockOrder(tx, orderNumber);
        // Only staged files of this very order: an unknown, foreign or already attached id matches nothing.
        const updated = await tx.execute<Row[]>(
          `update "evidence_files" set "return_request_id" = ?
           where "order_number" = ? and "return_request_id" is null and "id" in (${unique.map(() => "?").join(", ")})
           returning ${COLUMNS}`,
          [returnRequestId, orderNumber, ...unique],
        );
        if (updated.length !== unique.length) throw new Rollback();
        // The files' trail now belongs to the request, in the same transaction as the attach.
        await tx.execute(`update "evidence_audit_events" set "return_request_id" = ? where "evidence_file_id" in (${unique.map(() => "?").join(", ")})`, [returnRequestId, ...unique]);
        return { result: "attached" as const, files: updated.map(toFile) };
      }, joinOrOpen());
    } catch (error) {
      if (error instanceof Rollback) return { result: "invalid" };
      throw error;
    }
  }

  async deleteStaged(orderNumber: string, id: string): Promise<boolean> {
    if (!UUID_PATTERN.test(id)) return false;
    return this.em.transactional(async (tx) => {
      // Only a staged file of this order: an attached file is immutable (T-23), a foreign one does not match.
      const deleted = await tx.execute<{ id: string }[]>(
        `delete from "evidence_files" where "id" = ? and "order_number" = ? and "return_request_id" is null returning "id"`,
        [id, orderNumber],
      );
      if (deleted.length === 0) return false;
      await audit(tx, { fileId: id, orderNumber, action: "removed", actor: "guest" });
      return true;
    }, joinOrOpen());
  }

  async recordDownload(input: NewEvidenceDownload): Promise<void> {
    // One row per (agent, file) per 10 minutes: opening a card with six thumbnails twice is one entry, not twelve.
    await this.em.execute(
      `insert into "evidence_audit_events" ("evidence_file_id", "order_number", "return_request_id", "action", "actor", "agent_id", "created_at")
       select ?, ?, ?, 'downloaded', 'agent', ?, now()
       where not exists (
         select 1 from "evidence_audit_events"
         where "evidence_file_id" = ? and "agent_id" = ? and "action" = 'downloaded' and "created_at" > now() - interval '10 minutes'
       )`,
      [input.evidenceFileId, input.orderNumber, input.returnRequestId, input.agentId, input.evidenceFileId, input.agentId],
    );
  }

  async listAudit(returnRequestId: number): Promise<EvidenceAuditEntry[]> {
    const rows = await this.em.execute<
      { id: number; evidence_file_id: string; label: string | null; action: string; actor: string; agent_name: string | null; created_at: Date | string }[]
    >(
      `select a."id", a."evidence_file_id", f."label", a."action", a."actor", g."display_name" as "agent_name", a."created_at"
       from "evidence_audit_events" a
       left join "evidence_files" f on f."id" = a."evidence_file_id"
       left join "agents" g on g."id" = a."agent_id"
       where a."return_request_id" = ?
       order by a."created_at", a."id"`,
      [returnRequestId],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      evidenceFileId: row.evidence_file_id,
      label: row.label,
      action: EVIDENCE_AUDIT_ACTIONS.find((candidate) => candidate === row.action) ?? "downloaded",
      actor: row.actor === "agent" ? "agent" : "guest",
      agentName: row.agent_name,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    }));
  }

  async deleteForRequest(returnRequestId: number): Promise<number> {
    const deleted = await this.em.execute<{ id: string }[]>(`delete from "evidence_files" where "return_request_id" = ? returning "id"`, [returnRequestId]);
    return deleted.length;
  }
}
