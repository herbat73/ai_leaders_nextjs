import { z } from "zod";

import { PRODUCT_CATEGORIES } from "../../domain/claim-facts";
import { CLAIM_KINDS } from "../../domain/claim-kind";
import { parseMoney, type Money } from "../../domain/money";

export const CASE_SAMPLE_CHANNELS = ["mail", "phone"] as const;
export const CASE_SAMPLE_OUTCOMES = ["approved", "rejected", "partial", "cancelled", "open"] as const;
export const MAX_VALUE_PLN_MINOR = 100_000_000;

export type CaseSampleChannel = (typeof CASE_SAMPLE_CHANNELS)[number];
export type CaseSampleOutcome = (typeof CASE_SAMPLE_OUTCOMES)[number];

// Messages name the column's rule, never the cell value (the error log must not carry personal data).
function lowerEnum<const T extends readonly [string, ...string[]]>(values: T, message: string) {
  return z
    .string()
    .transform((value) => value.toLowerCase())
    .pipe(z.enum(values, { error: message }));
}

/** `YYYY-MM-DD` or `DD.MM.YYYY` to a real calendar date as `YYYY-MM-DD`, else `null`. */
export function parseCaseDate(input: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  const pl = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(input);
  const [year, month, day] = iso ? [iso[1], iso[2], iso[3]] : pl ? [pl[3], pl[2], pl[1]] : [];
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const normalized = `${year}-${month}-${day}`;
  return date.toISOString().slice(0, 10) === normalized ? normalized : null;
}

const dateField = z.string().transform((value, ctx): string => {
  const date = parseCaseDate(value);
  if (date === null) {
    ctx.addIssue({ code: "custom", message: "Data w formacie RRRR-MM-DD lub DD.MM.RRRR" });
    return z.NEVER;
  }
  return date;
});

const intField = (max: number) =>
  z
    .string()
    .regex(/^\d+$/, { error: `Liczba całkowita od 0 do ${max}` })
    .transform(Number)
    .pipe(z.number().int().max(max, { error: `Liczba całkowita od 0 do ${max}` }));

export interface CaseSampleRow {
  case_ref: string;
  channel: CaseSampleChannel;
  kind: (typeof CLAIM_KINDS)[number];
  category: (typeof PRODUCT_CATEGORIES)[number];
  value_pln: Money;
  opened_on: string;
  resolved_on: string | null;
  follow_up_requests: number;
  messages_exchanged: number;
  outcome: CaseSampleOutcome;
}

/** The CSV column whitelist (Data Model contract). Cells arrive as strings; the schema parses them. */
export const caseSampleRowSchema = z
  .object({
    case_ref: z
      .string()
      .regex(/^[A-Za-z][A-Za-z0-9-]{0,19}$/, {
        error: "Numer sprawy musi zaczynać się literą (np. S01), nie może być numerem zamówienia",
      }),
    channel: lowerEnum(CASE_SAMPLE_CHANNELS, "Kanał: mail lub phone"),
    kind: lowerEnum(CLAIM_KINDS, "Rodzaj: return, complaint, transport lub missing"),
    category: lowerEnum(PRODUCT_CATEGORIES, "Kategoria: electronics, appliances, home, clothing, hygiene lub other"),
    value_pln: z.string().transform((value, ctx): Money => {
      const parsed = parseMoney(value);
      if (parsed === null || parsed.amountMinor > MAX_VALUE_PLN_MINOR) {
        ctx.addIssue({ code: "custom", message: "Kwota od 0 do 1 000 000 zł, np. 149,99" });
        return z.NEVER;
      }
      return parsed;
    }),
    opened_on: dateField,
    resolved_on: z.union([z.literal("").transform((): null => null), dateField]),
    follow_up_requests: intField(50),
    messages_exchanged: intField(200),
    outcome: lowerEnum(CASE_SAMPLE_OUTCOMES, "Wynik: approved, rejected, partial, cancelled lub open"),
  })
  .superRefine((row, ctx) => {
    if (row.resolved_on === null && row.outcome !== "open") {
      ctx.addIssue({ code: "custom", path: ["outcome"], message: "Brak daty zamknięcia wymaga wyniku open" });
    }
    if (row.resolved_on !== null && row.outcome === "open") {
      ctx.addIssue({ code: "custom", path: ["outcome"], message: "Wynik open wymaga pustej daty zamknięcia" });
    }
    if (row.resolved_on !== null && row.resolved_on < row.opened_on) {
      ctx.addIssue({ code: "custom", path: ["resolved_on"], message: "Data zamknięcia przed datą otwarcia" });
    }
  });
