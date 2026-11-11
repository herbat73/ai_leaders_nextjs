import { parseEvidenceLimits, parseScannerConfig, type EvidenceLimits, type MalwareScannerPort } from "@easyrms/core";

import { ClamdScanner } from "./clamd-scanner";

let limits: EvidenceLimits | undefined;

/** `EASYRMS_EVIDENCE_MAX_FILE_MB`, `_MAX_FILES`, `_MAX_ORDER_MB`; memoized, an invalid value is a configuration error on first use. */
export function getEvidenceLimits(): EvidenceLimits {
  limits ??= parseEvidenceLimits({
    maxFileMb: process.env.EASYRMS_EVIDENCE_MAX_FILE_MB,
    maxFiles: process.env.EASYRMS_EVIDENCE_MAX_FILES,
    maxOrderMb: process.env.EASYRMS_EVIDENCE_MAX_ORDER_MB,
  });
  return limits;
}

/**
 * The clamd client from `EASYRMS_CLAMAV_HOST` / `_PORT` / `_TIMEOUT_MS`. Built on first resolve and never at import, so
 * `next build` needs no configuration and production without a scanner address fails closed (opaque 500) on the first upload.
 */
export function createMalwareScanner(): MalwareScannerPort {
  return new ClamdScanner(
    parseScannerConfig({
      nodeEnv: process.env.NODE_ENV,
      host: process.env.EASYRMS_CLAMAV_HOST,
      port: process.env.EASYRMS_CLAMAV_PORT,
      timeoutMs: process.env.EASYRMS_CLAMAV_TIMEOUT_MS,
    }),
  );
}
