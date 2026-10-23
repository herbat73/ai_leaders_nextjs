import { warsawParts } from "../../calendar/warsaw-time";

const MIN_DIGITS = 5;

/**
 * `RMA-YYYY-NNNNN`: `YYYY` is the `Europe/Warsaw` year of `createdAt` (informational), `NNNNN` the sequence zero-padded
 * to at least five digits; it grows past that rather than truncating.
 */
export function formatRma(sequence: number, createdAt: Date): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new RangeError(`Invalid RMA sequence: ${sequence}`);
  const { year } = warsawParts(createdAt);
  return `RMA-${year}-${String(sequence).padStart(MIN_DIGITS, "0")}`;
}
