/** Content types an evidence file can have after re-encoding (Q3): images only, never SVG, PDF or video. */
export const EVIDENCE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type EvidenceContentType = (typeof EVIDENCE_CONTENT_TYPES)[number];

export const EVIDENCE_EXTENSIONS: Record<EvidenceContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Photos per report: the ceiling of `evidenceFileIds` in the submit body (Q4); the configured limit can only lower it. */
export const MAX_EVIDENCE_FILES = 6;

/** The numbers of Q4 (the owner may change them through configuration). */
export interface EvidenceLimits {
  /** Bytes per file. */
  maxFileBytes: number;
  /** Staged, not yet attached, files per order. */
  maxFilesPerRequest: number;
  /** Bytes of every file of one order (staged and attached). */
  maxBytesPerOrder: number;
  /** Decoded pixels per image, checked before the image is decoded in full (T-20). */
  maxPixels: number;
}

export const DEFAULT_EVIDENCE_LIMITS: EvidenceLimits = {
  maxFileBytes: 5 * 1024 * 1024,
  maxFilesPerRequest: 6,
  maxBytesPerOrder: 20 * 1024 * 1024,
  maxPixels: 40_000_000,
};

/** Metadata of a stored file; never carries the bytes. */
export interface EvidenceFile {
  /** Random UUID, unguessable. */
  id: string;
  orderNumber: string;
  /** `null` while the file is staged (uploaded, not yet attached to a request). */
  returnRequestId: number | null;
  contentType: EvidenceContentType;
  byteSize: number;
  /** SHA-256 of the stored (re-encoded) bytes, hex. */
  sha256: string;
  /** Sanitized original name, display only. */
  label: string;
  createdAt: Date;
}

/** What a request detail shows of an attached file: enough to render a thumbnail through the download route, never the bytes. */
export interface EvidenceSummary {
  id: string;
  label: string;
  contentType: EvidenceContentType;
  byteSize: number;
}

export interface EvidenceContent {
  file: EvidenceFile;
  data: Uint8Array;
}

export interface NewEvidenceFile {
  orderNumber: string;
  contentType: EvidenceContentType;
  data: Uint8Array;
  sha256: string;
  label: string;
}

/** What `stage` refuses: the per-request count or the per-order bytes would be exceeded. */
export type StageOutcome =
  | { result: "stored"; file: EvidenceFile }
  | { result: "too_many_files" }
  | { result: "quota_exceeded" };

export type AttachOutcome = { result: "attached"; files: EvidenceFile[] } | { result: "invalid" };

/** Port implemented by `@easyrms/db`. Files are immutable once attached: there is no update path (T-23). */
export interface EvidencePort {
  /**
   * In one transaction under the per-order lock: deletes staged files of the order created before `staleBefore`
   * (orphans), checks the count of staged files and the bytes of the order against `limits`, then inserts. Two tabs of
   * one order cannot both pass the check.
   */
  stage(input: NewEvidenceFile, limits: Pick<EvidenceLimits, "maxFilesPerRequest" | "maxBytesPerOrder">, staleBefore: Date): Promise<StageOutcome>;
  /** The file with its bytes, or `null`. */
  find(id: string): Promise<EvidenceContent | null>;
  /**
   * Attaches staged files of `orderNumber` to a request. All ids must exist, belong to the order and be unattached,
   * else nothing changes and the answer is `invalid` (the same for an unknown, foreign or already attached id).
   */
  attach(orderNumber: string, ids: readonly string[], returnRequestId: number): Promise<AttachOutcome>;
  /** Removes one staged (unattached) file of the order before submit; `false` when there is no such file (unknown, foreign or already attached). */
  deleteStaged(orderNumber: string, id: string): Promise<boolean>;
  /** Deletes every file of a request (erasure path, Q8); returns how many. */
  deleteForRequest(returnRequestId: number): Promise<number>;
}

/** What the scanner decided. `unavailable` covers every failure to get an answer: the caller fails closed. */
export type ScanVerdict = { status: "clean" } | { status: "infected" } | { status: "unavailable" };

export interface MalwareScannerPort {
  scan(data: Uint8Array): Promise<ScanVerdict>;
}

export interface ImageInfo {
  contentType: EvidenceContentType;
  width: number;
  height: number;
}

export type InspectOutcome =
  | { status: "ok"; info: ImageInfo }
  /** Not decodable as an image, or its dimensions exceed the pixel limit. */
  | { status: "rejected" }
  | { status: "unavailable" };

export type SanitizeOutcome =
  | { status: "ok"; contentType: EvidenceContentType; data: Uint8Array }
  | { status: "rejected" }
  | { status: "unavailable" };

export interface ImageSanitizerPort {
  /** Reads the header only: type and dimensions, rejecting beyond `maxPixels` before any full decode (T-20). */
  inspect(data: Uint8Array, limits: Pick<EvidenceLimits, "maxPixels">): Promise<InspectOutcome>;
  /** Decodes and re-encodes without metadata, in the same type, with a timeout. */
  sanitize(data: Uint8Array, limits: Pick<EvidenceLimits, "maxPixels">): Promise<SanitizeOutcome>;
}
