import type { ClaimFacts } from "../domain/claim-facts";
import { evaluate, type RuleMatch } from "./evaluate";
import { settles, type Rule } from "./rule.schema";

export interface Simulation {
  total: number;
  matchedByRule: Record<string, number>;
  /** Cases where at least one settling rule matched. */
  settled: number;
  perCase: RuleMatch[][];
}

export function simulate(cases: ClaimFacts[], rules: Rule[]): Simulation {
  const matchedByRule: Record<string, number> = {};
  for (const rule of rules) matchedByRule[rule.id] = 0;
  let settled = 0;
  const perCase = cases.map((facts) => {
    const matches = evaluate(facts, rules);
    for (const match of matches) matchedByRule[match.ruleId] = (matchedByRule[match.ruleId] ?? 0) + 1;
    if (matches.some((match) => settles(match.actions))) settled += 1;
    return matches;
  });
  return { total: cases.length, matchedByRule, settled, perCase };
}
