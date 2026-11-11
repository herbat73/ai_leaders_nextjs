import { ConfigurationError } from "../../errors";
import { DEFAULT_EVIDENCE_LIMITS, type EvidenceLimits } from "./types";

function positiveInt(name: string, raw: string | null | undefined, fallback: number, max: number): number {
  const value = (raw ?? "").trim();
  if (value === "") return fallback;
  const parsed = Number(value);
  if (!/^\d+$/.test(value) || parsed < 1 || parsed > max) {
    throw new ConfigurationError(`${name} must be a whole number from 1 to ${max}`);
  }
  return parsed;
}

const MB = 1024 * 1024;

/**
 * Parses the evidence limits from the environment values (core never reads env). Unset or blank keeps the numbers of
 * Q4 (5 MB per file, 6 per report, 20 MB per order); anything else that is not a whole number in range is a
 * configuration error. A file larger than the order quota could never be stored, so that combination is refused too.
 */
export function parseEvidenceLimits(env: {
  maxFileMb?: string | null;
  maxFiles?: string | null;
  maxOrderMb?: string | null;
}): EvidenceLimits {
  const maxFileBytes = positiveInt("EASYRMS_EVIDENCE_MAX_FILE_MB", env.maxFileMb, DEFAULT_EVIDENCE_LIMITS.maxFileBytes / MB, 25) * MB;
  const maxFilesPerRequest = positiveInt("EASYRMS_EVIDENCE_MAX_FILES", env.maxFiles, DEFAULT_EVIDENCE_LIMITS.maxFilesPerRequest, 20);
  const maxBytesPerOrder = positiveInt("EASYRMS_EVIDENCE_MAX_ORDER_MB", env.maxOrderMb, DEFAULT_EVIDENCE_LIMITS.maxBytesPerOrder / MB, 200) * MB;
  if (maxFileBytes > maxBytesPerOrder) {
    throw new ConfigurationError("EASYRMS_EVIDENCE_MAX_FILE_MB cannot exceed EASYRMS_EVIDENCE_MAX_ORDER_MB");
  }
  return { ...DEFAULT_EVIDENCE_LIMITS, maxFileBytes, maxFilesPerRequest, maxBytesPerOrder };
}

export interface ScannerConfig {
  host: string;
  port: number;
  timeoutMs: number;
}

/**
 * Parses the clamd address. `EASYRMS_CLAMAV_HOST` is required in production (unset is a configuration error on the
 * first upload, so the app never silently runs without a scanner); elsewhere it defaults to `localhost`. A scanner
 * that is configured but unreachable is not a configuration error: uploads are refused (fail closed, 503).
 */
export function parseScannerConfig(env: { nodeEnv?: string | null; host?: string | null; port?: string | null; timeoutMs?: string | null }): ScannerConfig {
  const host = (env.host ?? "").trim();
  if (host === "" && env.nodeEnv === "production") {
    throw new ConfigurationError("EASYRMS_CLAMAV_HOST is required in production");
  }
  if (/[\s/]/.test(host)) throw new ConfigurationError("EASYRMS_CLAMAV_HOST must be a host name or address");
  return {
    host: host === "" ? "localhost" : host,
    port: positiveInt("EASYRMS_CLAMAV_PORT", env.port, 3310, 65535),
    timeoutMs: positiveInt("EASYRMS_CLAMAV_TIMEOUT_MS", env.timeoutMs, 10_000, 120_000),
  };
}
