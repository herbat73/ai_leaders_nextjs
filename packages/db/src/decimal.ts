import { money, parseMoney, type Money } from "@easyrms/core";

/** Integer grosze to the `numeric(12,2)` text form, without a float round trip. */
export function toDecimal(m: Money): string {
  const abs = Math.abs(m.amountMinor);
  return `${m.amountMinor < 0 ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Stored decimals are written by the repositories only, so they always parse. */
export function fromDecimal(value: string | number): Money {
  return parseMoney(String(value)) ?? money(0);
}
