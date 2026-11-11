import { ConflictError, NotFoundError } from "../../errors";
import type { ApiLogger } from "../../http/types";
import { FINAL_REQUEST_STATUSES, type EraseResult, type RetentionPort, type RetentionRunResult } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

/**
 * Retention and erasure of customer data (T-21, R16). The period is passed in (from `EASYRMS_RETENTION_DAYS`), never
 * named here. A failure of one request is logged by id and RMA only, never with personal data, and does not stop the
 * others.
 */
export class RetentionService {
  private readonly retention: RetentionPort;
  private readonly clock: () => Date;
  private readonly logger: ApiLogger;
  private readonly retentionDays: number;

  constructor(deps: { retentionPort: RetentionPort; clock: () => Date; logger: ApiLogger; retentionDays: number }) {
    this.retention = deps.retentionPort;
    this.clock = deps.clock;
    this.logger = deps.logger;
    this.retentionDays = deps.retentionDays;
  }

  async run(options: { dryRun?: boolean } = {}): Promise<RetentionRunResult> {
    const dryRun = options.dryRun === true;
    const cutoff = new Date(this.clock().getTime() - this.retentionDays * DAY_MS);
    const result: RetentionRunResult = { dryRun, cutoff, requests: 0, files: 0, auditRows: 0, orphanFiles: 0, orphanAuditRows: 0, rmas: [], failed: [] };

    let afterId = 0;
    for (;;) {
      const batch = await this.retention.findDue(cutoff, BATCH_SIZE, afterId);
      if (batch.length === 0) break;
      for (const target of batch) {
        afterId = Math.max(afterId, target.id);
        if (dryRun) {
          result.requests += 1;
          result.rmas.push(target.rma);
          continue;
        }
        try {
          const counts = await this.retention.anonymize(target.id);
          // Erased meanwhile by another run or an erasure request: not counted or listed as this run's work.
          if (!counts.erased) continue;
          result.requests += 1;
          result.files += counts.files;
          result.auditRows += counts.auditRows;
          result.rmas.push(target.rma);
        } catch (cause) {
          this.logger.error("retention: request not anonymized", { requestId: target.id, rma: target.rma, error: cause instanceof Error ? cause.message : "unknown" });
          result.failed.push({ id: target.id, rma: target.rma });
        }
      }
    }

    if (!dryRun) {
      const orphans = await this.retention.purgeOrphans(cutoff);
      result.orphanFiles = orphans.files;
      result.orphanAuditRows = orphans.auditRows;
    }
    return result;
  }

  /** One customer's erasure request: same anonymization as the job, at once. A request not yet closed needs `force`. */
  async eraseOne(rma: string, options: { force?: boolean } = {}): Promise<EraseResult> {
    const target = await this.retention.findByRma(rma);
    if (!target) throw new NotFoundError("Request not found");
    if (target.anonymizedAt) return { rma: target.rma, alreadyErased: true, files: 0, auditRows: 0 };
    const isFinal = (FINAL_REQUEST_STATUSES as readonly string[]).includes(target.status);
    if (!isFinal && options.force !== true) {
      throw new ConflictError("Request is not closed; use force to erase it anyway", { status: target.status });
    }
    const counts = await this.retention.anonymize(target.id);
    if (!counts.erased) return { rma: target.rma, alreadyErased: true, files: 0, auditRows: 0 };
    return { rma: target.rma, alreadyErased: false, files: counts.files, auditRows: counts.auditRows };
  }
}
