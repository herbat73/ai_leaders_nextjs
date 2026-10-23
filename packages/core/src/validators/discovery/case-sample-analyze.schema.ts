import { z } from "zod";

import { parseMoney } from "../../domain/money";
import { MAX_VALUE_PLN_MINOR } from "./case-sample-row.schema";

export const MAX_CSV_BYTES = 524_288;
/** 2× the CSV limit: JSON escaping can nearly double a legitimate CSV, the exact limit is enforced by the schema. */
export const MAX_BODY_BYTES = 1_048_576;
export const TOO_LARGE_MESSAGE = "Plik jest zbyt duży (limit 512 KB)";
export const TUNABLE_RULE_IDS = ["R08", "R09"] as const;

export interface CaseSampleAnalyzeInput {
  csv: string;
  /** Overrides in minor units, only R08/R09. */
  thresholds?: Partial<Record<(typeof TUNABLE_RULE_IDS)[number], number>>;
}

export const caseSampleAnalyzeSchema: z.ZodType<CaseSampleAnalyzeInput, unknown> = z.object({
  csv: z
    .string()
    .min(1, "Plik CSV jest pusty")
    .refine((text) => new TextEncoder().encode(text).byteLength <= MAX_CSV_BYTES, TOO_LARGE_MESSAGE),
  thresholds: z
    .record(z.string(), z.string())
    .optional()
    .transform((thresholds, ctx): CaseSampleAnalyzeInput["thresholds"] => {
      if (thresholds === undefined) return undefined;
      const result: Record<string, number> = {};
      for (const [id, text] of Object.entries(thresholds)) {
        const money = parseMoney(text);
        if (!(TUNABLE_RULE_IDS as readonly string[]).includes(id)) {
          ctx.addIssue({ code: "custom", path: [id], message: "Tylko reguły R08 i R09 mają progi" });
        } else if (money === null || money.amountMinor > MAX_VALUE_PLN_MINOR) {
          ctx.addIssue({ code: "custom", path: [id], message: "Kwota od 0 do 1 000 000 zł, np. 200,00" });
        } else result[id] = money.amountMinor;
      }
      return result;
    }),
});
