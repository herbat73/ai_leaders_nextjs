const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
// A plain decimal such as `1000000.00` or `1000000,00` is never a phone number.
const DECIMAL = /^\d+[.,]\d{1,2}$/;

/**
 * Heuristic backstop for personal data in a raw cell: an e-mail, or a phone number (exactly nine digits after
 * removing spaces, dashes, dots, brackets and a leading +48/0048). It cannot catch everything; the column whitelist
 * is the real control.
 */
export function looksLikePersonalData(cell: string): boolean {
  const trimmed = cell.trim();
  if (trimmed === "") return false;
  if (EMAIL.test(trimmed)) return true;
  if (DECIMAL.test(trimmed)) return false;
  const digits = trimmed.replace(/[\s\-.,()[\]]/g, "").replace(/^(?:\+48|0048)/, "");
  return /^\d{9}$/.test(digits);
}
