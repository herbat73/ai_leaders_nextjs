import { TransactionPropagation } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import { FINAL_REQUEST_STATUSES, type AnonymizeCounts, type RetentionPort, type RetentionTarget } from "@easyrms/core";

interface TargetRow {
  id: number;
  rma: string;
  status: string;
  anonymized_at: Date | string | null;
}

function toTarget(row: TargetRow): RetentionTarget {
  return {
    id: row.id,
    rma: row.rma,
    status: row.status,
    anonymizedAt: row.anonymized_at === null ? null : row.anonymized_at instanceof Date ? row.anonymized_at : new Date(row.anonymized_at),
  };
}

const FINAL_LIST = FINAL_REQUEST_STATUSES.map(() => "?").join(", ");

/**
 * Persistence of the retention job (T-21). Raw SQL stays in this repository (MikroORM has no bulk "blank these columns
 * and delete those rows" API that keeps one statement per table); every value is a bound parameter.
 */
export class MikroOrmRetentionRepository implements RetentionPort {
  private readonly em: EntityManager;

  constructor(deps: { em: EntityManager }) {
    this.em = deps.em;
  }

  async findDue(cutoff: Date, limit: number, afterId: number): Promise<RetentionTarget[]> {
    // The clock starts at the last status change; a request with no event (legacy rows) falls back to `updated_at`.
    const rows = await this.em.execute<TargetRow[]>(
      `select r."id", r."rma", r."status", r."anonymized_at" from "return_requests" r
       where r."anonymized_at" is null and r."status" in (${FINAL_LIST}) and r."id" > ?
         and coalesce((select max(e."created_at") from "return_request_events" e where e."return_request_id" = r."id"), r."updated_at") < ?
       order by r."id" limit ?`,
      [...FINAL_REQUEST_STATUSES, afterId, cutoff, limit],
    );
    return rows.map(toTarget);
  }

  async findByRma(rma: string): Promise<RetentionTarget | null> {
    const rows = await this.em.execute<TargetRow[]>(`select "id", "rma", "status", "anonymized_at" from "return_requests" where "rma" = ?`, [rma]);
    return rows.length === 0 ? null : toTarget(rows[0]);
  }

  async anonymize(requestId: number): Promise<AnonymizeCounts> {
    return this.em.transactional(
      async (tx): Promise<AnonymizeCounts> => {
        // Locks the row and skips a request another run already erased.
        const locked = await tx.execute<{ id: number }[]>(`select "id" from "return_requests" where "id" = ? and "anonymized_at" is null for update`, [requestId]);
        if (locked.length === 0) return { erased: false, files: 0, auditRows: 0 };

        // Audit rows first: they are found through the files, which the next statement deletes.
        const audit = await tx.execute<{ id: number }[]>(
          `delete from "evidence_audit_events" where "return_request_id" = ?
             or "evidence_file_id" in (select "id" from "evidence_files" where "return_request_id" = ?) returning "id"`,
          [requestId, requestId],
        );
        const files = await tx.execute<{ id: string }[]>(`delete from "evidence_files" where "return_request_id" = ? returning "id"`, [requestId]);

        await tx.execute(`update "return_request_items" set "comment" = null where "return_request_id" = ?`, [requestId]);
        await tx.execute(`update "return_request_events" set "note" = null where "return_request_id" = ?`, [requestId]);
        await tx.execute(
          `update "supplier_claim_events" set "note" = null where "supplier_claim_id" in (select "id" from "supplier_claims" where "return_request_id" = ?)`,
          [requestId],
        );
        await tx.execute(`update "supplier_claims" set "subject" = '', "body" = '', "answer_note" = null where "return_request_id" = ?`, [requestId]);
        await tx.execute(
          `update "return_requests" set "customer_email" = 'erased-' || "rma" || '@anonymized.invalid', "reason" = null, "defect_description" = null,
             "exchange_note" = null, "decision_note" = null, "anonymized_at" = now(), "updated_at" = now() where "id" = ?`,
          [requestId],
        );
        return { erased: true, files: files.length, auditRows: audit.length };
      },
      { propagation: TransactionPropagation.REQUIRED },
    );
  }

  async purgeOrphans(cutoff: Date): Promise<{ files: number; auditRows: number }> {
    return this.em.transactional(
      async (tx): Promise<{ files: number; auditRows: number }> => {
        // A staged file is attached by the submit of the same guest session (2 hours at most), so one past the retention
        // period can no longer be attached by anyone.
        const files = await tx.execute<{ id: string }[]>(`delete from "evidence_files" where "return_request_id" is null and "created_at" < ? returning "id"`, [cutoff]);
        const audit = await tx.execute<{ id: number }[]>(
          `delete from "evidence_audit_events" where "return_request_id" is null and "created_at" < ? returning "id"`,
          [cutoff],
        );
        return { files: files.length, auditRows: audit.length };
      },
      { propagation: TransactionPropagation.REQUIRED },
    );
  }
}
