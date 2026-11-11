import { createHash } from "node:crypto";

import { AppError, NotFoundError, TooManyRequestsError } from "../../errors";
import type { ApiLogger } from "../../http/types";
import type { RateLimiterPort, RateRule } from "../../security/rate-limiter";
import { GUEST_SESSION_TTL_SECONDS } from "../returns/guest-session.service";
import { detectImageType, sanitizeLabel } from "./detect";
import {
  DEFAULT_EVIDENCE_LIMITS,
  type AttachOutcome,
  type EvidenceAuditEntry,
  type EvidenceContent,
  type EvidenceFile,
  type EvidenceContentType,
  type EvidenceLimits,
  type EvidencePort,
  type ImageSanitizerPort,
  type MalwareScannerPort,
} from "./types";

/** Uploads per (order, client IP): a starting value the owner confirms (spec, API contracts). */
export const EVIDENCE_UPLOAD_RULE: RateRule = { limit: 20, windowMs: 10 * 60_000 };

export const evidenceRateKey = (orderNumber: string, ip: string): string => `evidence:${orderNumber}:${ip}`;

/** Staged files older than the guest session can no longer be attached by anyone: they are deleted on the next upload. */
export const STAGED_FILE_TTL_MS = GUEST_SESSION_TTL_SECONDS * 1000;

/** Who reads a file: any signed-in agent, or the guest session of exactly one order. */
export type EvidencePrincipal = { kind: "agent"; agentId?: number } | { kind: "guest"; orderNumber: string };

export interface EvidenceUploadResult {
  id: string;
  byteSize: number;
  contentType: EvidenceContentType;
}

export const NOT_FOUND_MESSAGE = "File not found";

const error = (status: number, code: string, message: string): AppError => new AppError(message, status, code);

/**
 * Upload and read rules for evidence images. Order of an upload: rate limit, size, type by content, header inspection
 * under the pixel limit, malware scan of the original, re-encode without metadata, store. Nothing unscanned or
 * unsanitized is ever stored (this replaces a quarantine state, T-16), and the scanner or sanitizer being down refuses
 * the upload (fail closed). The bytes of a rejected file are never logged.
 */
export class EvidenceService {
  private readonly evidence: EvidencePort;
  private readonly scanner: MalwareScannerPort;
  private readonly sanitizer: ImageSanitizerPort;
  private readonly rateLimiter: RateLimiterPort;
  private readonly clock: () => Date;
  private readonly logger: ApiLogger;
  private readonly limits: EvidenceLimits;

  constructor(deps: {
    evidencePort: EvidencePort;
    malwareScanner: MalwareScannerPort;
    imageSanitizer: ImageSanitizerPort;
    rateLimiter: RateLimiterPort;
    clock: () => Date;
    logger: ApiLogger;
    /** Optional: the defaults of Q4 when absent. */
    evidenceLimits?: EvidenceLimits;
  }) {
    this.evidence = deps.evidencePort;
    this.scanner = deps.malwareScanner;
    this.sanitizer = deps.imageSanitizer;
    this.rateLimiter = deps.rateLimiter;
    this.clock = deps.clock;
    this.logger = deps.logger;
    this.limits = deps.evidenceLimits ?? DEFAULT_EVIDENCE_LIMITS;
  }

  /** The per-file cap, so the route can cap the stream before anything is buffered. */
  get maxFileBytes(): number {
    return this.limits.maxFileBytes;
  }

  /**
   * `readFile` is called after the rate limit passes, so a throttled client never makes the server read its body. It
   * returns the raw bytes and the client's file name.
   */
  async upload(input: {
    orderNumber: string;
    ip: string;
    readFile: () => Promise<{ data: Uint8Array; name?: string | null }>;
  }): Promise<EvidenceUploadResult> {
    const decision = await this.rateLimiter.consume(evidenceRateKey(input.orderNumber, input.ip), EVIDENCE_UPLOAD_RULE);
    if (!decision.allowed) throw new TooManyRequestsError();

    const { data, name } = await input.readFile();
    if (data.byteLength > this.limits.maxFileBytes) throw error(413, "too_large", "The file is too large");
    const detected = detectImageType(data);
    if (detected === null) throw error(400, "not_an_image", "Only JPEG, PNG and WebP images are accepted");

    const inspected = await this.sanitizer.inspect(data, this.limits);
    if (inspected.status === "unavailable") throw this.unavailable("inspect");
    if (inspected.status === "rejected" || inspected.info.contentType !== detected) throw this.rejected();

    const verdict = await this.scanner.scan(data);
    if (verdict.status === "unavailable") throw this.unavailable("scan");
    if (verdict.status === "infected") throw this.rejected();

    const clean = await this.sanitizer.sanitize(data, this.limits);
    if (clean.status === "unavailable") throw this.unavailable("sanitize");
    if (clean.status === "rejected" || detectImageType(clean.data) !== clean.contentType) throw this.rejected();

    const staleBefore = new Date(this.clock().getTime() - STAGED_FILE_TTL_MS);
    const outcome = await this.evidence.stage(
      {
        orderNumber: input.orderNumber,
        contentType: clean.contentType,
        data: clean.data,
        sha256: createHash("sha256").update(clean.data).digest("hex"),
        label: sanitizeLabel(name),
      },
      this.limits,
      staleBefore,
    );
    if (outcome.result === "too_many_files") throw error(409, "quota_exceeded", `At most ${this.limits.maxFilesPerRequest} photos per report`);
    if (outcome.result === "quota_exceeded") throw error(409, "quota_exceeded", "The photo storage of this order is full");
    return { id: outcome.file.id, byteSize: outcome.file.byteSize, contentType: outcome.file.contentType };
  }

  /**
   * The file for `principal`. An unknown id, a deleted file and another order's file give the same 404 (T-17), so
   * existence is never revealed.
   */
  async read(id: string, principal: EvidencePrincipal): Promise<EvidenceContent> {
    const content = await this.evidence.find(id);
    if (!content) throw new NotFoundError(NOT_FOUND_MESSAGE);
    if (principal.kind === "guest" && principal.orderNumber !== content.file.orderNumber) throw new NotFoundError(NOT_FOUND_MESSAGE);
    if (principal.kind === "agent" && principal.agentId !== undefined) await this.auditDownload(content.file, principal.agentId);
    return content;
  }

  /**
   * The customer takes back a photo before submitting. Only a staged file of the session's own order: an unknown,
   * foreign or already attached id is the same 404 as a read (T-17), and an attached file can never be removed (T-23).
   */
  async removeStaged(orderNumber: string, id: string): Promise<void> {
    if (!(await this.evidence.deleteStaged(orderNumber, id))) throw new NotFoundError(NOT_FOUND_MESSAGE);
  }

  /**
   * Agent downloads are recorded, but a failing audit write must not stop an agent from reading a customer's evidence
   * (a read is not a change): it is logged without values and the read goes on. Adds and removals are the opposite:
   * they write their row inside their own transaction, so a failed audit write fails the change (fail closed).
   */
  private async auditDownload(file: EvidenceFile, agentId: number): Promise<void> {
    try {
      await this.evidence.recordDownload({ evidenceFileId: file.id, orderNumber: file.orderNumber, returnRequestId: file.returnRequestId, agentId });
    } catch (error) {
      this.logger.error("evidence download audit failed", { name: error instanceof Error ? error.name : typeof error });
    }
  }

  /** The audit trail of a request's photos, for the agent's decision card. */
  listAudit(returnRequestId: number): Promise<EvidenceAuditEntry[]> {
    return this.evidence.listAudit(returnRequestId);
  }

  /** Attaches staged files of the order to a request, once. */
  attach(orderNumber: string, ids: readonly string[], returnRequestId: number): Promise<AttachOutcome> {
    return this.evidence.attach(orderNumber, ids, returnRequestId);
  }

  /** Erasure path (Q8): deletes the files with their request. Nothing calls it automatically yet (T-21). */
  deleteForRequest(returnRequestId: number): Promise<number> {
    return this.evidence.deleteForRequest(returnRequestId);
  }

  private rejected(): AppError {
    // The message does not say whether the file was infected or undecodable.
    return error(422, "rejected", "The file was rejected");
  }

  private unavailable(stage: string): AppError {
    this.logger.error("evidence upload refused: checker unavailable", { stage });
    return error(503, "scanner_unavailable", "We cannot accept photos right now, try again shortly");
  }
}
