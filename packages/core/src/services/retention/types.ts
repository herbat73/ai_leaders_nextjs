/** Statuses no state machine moves out of (`returnStateMachine`, `complaintStateMachine`, `damageStateMachine`). */
export const FINAL_REQUEST_STATUSES = ["resolved", "rejected", "cancelled"] as const;

export interface RetentionTarget {
  id: number;
  rma: string;
  status: string;
  /** Set once the request has been anonymized; such a request is never processed again. */
  anonymizedAt: Date | null;
}

export interface AnonymizeCounts {
  /** `false` when the request was already erased (for example by a concurrent run) and this call changed nothing. */
  erased: boolean;
  files: number;
  auditRows: number;
}

/**
 * What the retention job needs from persistence. `findDue` returns requests in a final status whose last status change
 * is before `cutoff` and that are not anonymized yet, ordered by id and starting after `afterId`, so a request that
 * keeps failing cannot hold the loop. `anonymize` is one transaction per request: files, audit rows, free text, e-mail
 * placeholder, linked supplier-claim texts and the `anonymizedAt` mark commit together or not at all.
 */
export interface RetentionPort {
  findDue(cutoff: Date, limit: number, afterId: number): Promise<RetentionTarget[]>;
  findByRma(rma: string): Promise<RetentionTarget | null>;
  anonymize(requestId: number): Promise<AnonymizeCounts>;
  /**
   * Staged files that never reached a request and are older than `cutoff` (the next upload to their order would purge
   * them only if there is one), plus the audit rows of those files and any request-less audit row older than `cutoff`.
   */
  purgeOrphans(cutoff: Date): Promise<{ files: number; auditRows: number }>;
}

export interface RetentionRunResult {
  dryRun: boolean;
  cutoff: Date;
  requests: number;
  files: number;
  auditRows: number;
  orphanFiles: number;
  orphanAuditRows: number;
  /** RMA numbers: the requests that would be (dry run) or were anonymized. */
  rmas: string[];
  failed: { id: number; rma: string }[];
}

export interface EraseResult {
  rma: string;
  alreadyErased: boolean;
  files: number;
  auditRows: number;
}
