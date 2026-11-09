import { z } from "zod";

import { parseMoney } from "../../domain/money";
import { TUNABLE_RULE_IDS } from "../discovery/case-sample-analyze.schema";
import { MAX_VALUE_PLN_MINOR } from "../discovery/case-sample-row.schema";

export interface RulesSimulateInput {
  /** Overrides in minor units, only R08/R09. Empty means "current thresholds". */
  thresholds: Partial<Record<(typeof TUNABLE_RULE_IDS)[number], number>>;
}

/** Thresholds arrive as text amounts ("200,00" or "200"), like the discovery lab form; nothing is stored. */
export const rulesSimulateSchema: z.ZodType<RulesSimulateInput, unknown> = z.object({
  thresholds: z
    .record(z.string(), z.string())
    .transform((thresholds, ctx): RulesSimulateInput["thresholds"] => {
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
