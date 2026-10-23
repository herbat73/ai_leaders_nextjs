import { warsawParts } from "./warsaw-time";

/** Polish month names in the genitive case, as used in dates ("23 października"); hard-coded so no ICU data is needed. */
const MONTHS_GENITIVE_PL = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
] as const;

/** Calendar date for display, e.g. `23 października 2026`, read in `Europe/Warsaw` (not in UTC). */
export function formatDatePl(date: Date): string {
  const { year, month, day } = warsawParts(date);
  return `${day} ${MONTHS_GENITIVE_PL[month - 1]} ${year}`;
}

/** Short numeric date, e.g. `23.10.2026`, read in `Europe/Warsaw`. */
export function formatDateShortPl(date: Date): string {
  const { year, month, day } = warsawParts(date);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}
