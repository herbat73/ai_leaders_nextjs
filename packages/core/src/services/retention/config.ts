import { ConfigurationError } from "../../errors";

/** Legal's confirmed period (R16, 2026-11-11). The setting overrides it; nothing else in the code names a number of days. */
export const DEFAULT_RETENTION_DAYS = 365;
export const MIN_RETENTION_DAYS = 30;
export const MAX_RETENTION_DAYS = 3650;

/**
 * Parses `EASYRMS_RETENTION_DAYS` (core never reads env). Unset or blank is the default; anything that is not a whole
 * number from 30 to 3650 is a configuration error, so a typo can never make the job delete recent data.
 */
export function parseRetentionDays(raw: string | null | undefined): number {
  const value = (raw ?? "").trim();
  if (value === "") return DEFAULT_RETENTION_DAYS;
  const parsed = Number(value);
  if (!/^\d+$/.test(value) || parsed < MIN_RETENTION_DAYS || parsed > MAX_RETENTION_DAYS) {
    throw new ConfigurationError(`EASYRMS_RETENTION_DAYS must be a whole number from ${MIN_RETENTION_DAYS} to ${MAX_RETENTION_DAYS}`);
  }
  return parsed;
}
