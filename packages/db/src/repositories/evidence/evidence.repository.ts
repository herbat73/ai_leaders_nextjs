import { TransactionPropagation } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import { randomUUID } from "node:crypto";
import {
  EVIDENCE_CONTENT_TYPES,
  type AttachOutcome,
  type EvidenceContent,
  type EvidenceFile,
  type EvidenceLimits,
  type EvidencePort,
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
      if (row) return { result: "stored" as const, file: toFile(row) };
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
        return { result: "attached" as const, files: updated.map(toFile) };
      }, joinOrOpen());
    } catch (error) {
      if (error instanceof Rollback) return { result: "invalid" };
      throw error;
    }
  }

  async deleteStaged(orderNumber: string, id: string): Promise<boolean> {
    if (!UUID_PATTERN.test(id)) return false;
    // Only a staged file of this order: an attached file is immutable (T-23), a foreign one does not match.
    const deleted = await this.em.execute<{ id: string }[]>(
      `delete from "evidence_files" where "id" = ? and "order_number" = ? and "return_request_id" is null returning "id"`,
      [id, orderNumber],
    );
    return deleted.length > 0;
  }

  async deleteForRequest(returnRequestId: number): Promise<number> {
    const deleted = await this.em.execute<{ id: string }[]>(`delete from "evidence_files" where "return_request_id" = ? returning "id"`, [returnRequestId]);
    return deleted.length;
  }
}
