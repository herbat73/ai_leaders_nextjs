export type Currency = "PLN";

/** An amount in integer minor units (grosze). Never a float. */
export interface Money {
  amountMinor: number;
  currency: Currency;
}

const NBSP = " ";

function assertMinor(amountMinor: number): void {
  if (!Number.isSafeInteger(amountMinor)) throw new RangeError("Money amount is not a safe integer");
}

export function money(amountMinor: number, currency: Currency = "PLN"): Money {
  assertMinor(amountMinor);
  return { amountMinor, currency };
}

/**
 * Parses a user-typed amount such as `149,99`, `149.99` or `1 299,00` into minor units.
 * Returns `null` for anything else: negatives, more than two decimals, junk, or an unsafe integer.
 */
export function parseMoney(input: string): Money | null {
  const text = input.replace(/[\s ]/g, "");
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const amountMinor = whole * 100 + fraction;
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(amountMinor)) return null;
  return { amountMinor, currency: "PLN" };
}

/** Negative when `a < b`, zero when equal, positive when `a > b`. */
export function compareMoney(a: Money, b: Money): number {
  if (a.currency !== b.currency) throw new RangeError("Cannot compare different currencies");
  return a.amountMinor - b.amountMinor;
}

/** `m × quantity` for a non-negative integer quantity; throws on a bad quantity or a result beyond the safe integers. */
export function multiplyMoney(m: Money, quantity: number): Money {
  if (!Number.isInteger(quantity) || quantity < 0) throw new RangeError("Quantity must be a non-negative integer");
  const amountMinor = m.amountMinor * quantity;
  assertMinor(amountMinor);
  return { amountMinor, currency: m.currency };
}

/** pl-PL text such as `149,99 zł` or `1 299,00 zł` (U+00A0 between digit groups and before `zł`). Needs no ICU data. */
export function formatMoney(m: Money): string {
  assertMinor(m.amountMinor);
  const negative = m.amountMinor < 0;
  const abs = Math.abs(m.amountMinor);
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const fraction = (abs % 100).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole},${fraction}${NBSP}zł`;
}
