import { warsawParts } from "../../calendar/warsaw-time";

const MIN_DIGITS = 5;

/** `SC-YYYY-NNNNN`: the `Europe/Warsaw` year of `createdAt` (informational) and the sequence zero-padded to five digits. */
export function formatClaimRef(sequence: number, createdAt: Date): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new RangeError(`Invalid claim sequence: ${sequence}`);
  const { year } = warsawParts(createdAt);
  return `SC-${year}-${String(sequence).padStart(MIN_DIGITS, "0")}`;
}
