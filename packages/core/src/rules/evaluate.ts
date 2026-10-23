import type { ClaimFacts } from "../domain/claim-facts";
import type { Action, Condition, Rule } from "./rule.schema";

export interface RuleMatch {
  ruleId: string;
  actions: Action[];
}

function holds(condition: Condition, facts: ClaimFacts): boolean {
  switch (condition.type) {
    case "kind_in":
      return condition.kinds.includes(facts.kind);
    case "category_in":
      return facts.categories.some((category) => condition.categories.includes(category));
    case "value_lte":
      return facts.value.amountMinor <= condition.amountMinor;
    case "value_gte":
      return facts.value.amountMinor >= condition.amountMinor;
  }
}

/** Enabled rules in `order`; all conditions are ANDed (an empty `when` matches); every match fires. */
export function evaluate(facts: ClaimFacts, rules: Rule[]): RuleMatch[] {
  return rules
    .filter((rule) => rule.enabled)
    .sort((a, b) => a.order - b.order)
    .filter((rule) => rule.when.every((condition) => holds(condition, facts)))
    .map((rule) => ({ ruleId: rule.id, actions: rule.then }));
}
