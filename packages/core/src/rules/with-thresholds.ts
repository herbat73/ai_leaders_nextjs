import { ValidationError } from "../errors";
import type { Rule } from "./rule.schema";

/** Replaces the single tunable value condition of each named rule; unknown or non-tunable ids are rejected. */
export function withThresholds(rules: Rule[], overrides: Record<string, number>): Rule[] {
  const fields: Record<string, string> = {};
  for (const id of Object.keys(overrides)) {
    const rule = rules.find((candidate) => candidate.id === id);
    if (!rule) fields[`thresholds.${id}`] = "Unknown rule";
    else if (!rule.when.some((c) => (c.type === "value_lte" || c.type === "value_gte") && c.tunable)) {
      fields[`thresholds.${id}`] = "Rule has no tunable threshold";
    }
  }
  if (Object.keys(fields).length > 0) throw new ValidationError("Invalid thresholds", fields);

  return rules.map((rule) => {
    const amountMinor = overrides[rule.id];
    if (amountMinor === undefined) return rule;
    return {
      ...rule,
      when: rule.when.map((c) =>
        (c.type === "value_lte" || c.type === "value_gte") && c.tunable ? { ...c, amountMinor } : c,
      ),
    };
  });
}
