import type { ClaimFacts } from "../../domain/claim-facts";
import { money } from "../../domain/money";
import { evaluate, type Rule } from "../../rules";
import type { RequestKind, ReturnRequest, RuleComparisonRecord } from "./types";

export interface RecommendationRule {
  id: string;
  name: string;
}

/**
 * What the rules engine recommends for one request (R08-R10). Advice for the agent only: nothing is decided or mailed.
 * `highPriority` (R10a) holds for every `transport` request, with or without an amount.
 */
export interface Recommendation {
  /** `approve` when R08 (auto-approve) or R09 (keep the item) matches; `none` otherwise. */
  recommended: "approve" | "none";
  /** Ids of the rules behind `approve`; empty for `none`. */
  ruleIds: string[];
  /** True when the approving rule is R09: the customer keeps the goods and is compensated. */
  keepItem: boolean;
  highPriority: boolean;
  /** R10c: the value reaches the manager threshold. A hint only; the refund limit (R11) stays the gate. */
  assignManager: boolean;
  /** Every rule that matched, for display. */
  rules: RecommendationRule[];
}

export const NO_RECOMMENDATION: Recommendation = {
  recommended: "none",
  ruleIds: [],
  keepItem: false,
  highPriority: false,
  assignManager: false,
  rules: [],
};

type Subject = Pick<ReturnRequest, "kind" | "resolutionAmount">;

/**
 * Evaluates `rules` on a stored request. The value is the resolution amount; a request without one (exchange, legacy
 * rows) gets no recommendation, because no value rule can be shown to hold. Product categories are not stored, so
 * category rules (R10b) never match.
 */
export function recommend(request: Subject, rules: Rule[]): Recommendation {
  const amount = request.resolutionAmount;
  // Without an amount (replacement, resend, exchange) no value rule can be shown to hold, so only the priority
  // marker (R10a, a kind rule) is read; the facts carry a zero value that the other rules' actions are dropped for.
  const facts: ClaimFacts = { kind: request.kind as RequestKind, value: amount ?? money(0), categories: [] };
  const matches = evaluate(facts, rules);
  if (matches.length === 0) return NO_RECOMMENDATION;

  const actions = matches
    .flatMap((match) => match.actions.map((action) => ({ ruleId: match.ruleId, action })))
    .filter(({ action }) => Boolean(amount) || action.type === "high_priority");
  if (actions.length === 0) return NO_RECOMMENDATION;
  const approving = actions.filter(({ action }) => action.type === "auto_approve" || action.type === "keep_item");
  const names = new Map(rules.map((rule) => [rule.id, rule.name]));

  return {
    recommended: approving.length > 0 ? "approve" : "none",
    ruleIds: [...new Set(approving.map(({ ruleId }) => ruleId))],
    keepItem: approving.some(({ action }) => action.type === "keep_item"),
    highPriority: actions.some(({ action }) => action.type === "high_priority"),
    assignManager: actions.some(({ action }) => action.type === "assign"),
    rules: matches
      .filter((match) => actions.some((entry) => entry.ruleId === match.ruleId))
      .map((match) => ({ id: match.ruleId, name: names.get(match.ruleId) ?? match.ruleId })),
  };
}

/** The comparison to store when an agent approves or rejects; `null` for any other move. */
export function compareDecision(recommendation: Recommendation, target: string): RuleComparisonRecord | null {
  if (target !== "approved" && target !== "rejected") return null;
  return {
    recommended: recommendation.recommended,
    ruleIds: recommendation.ruleIds,
    actualStatus: target,
    followed: recommendation.recommended === "approve" ? target === "approved" : null,
  };
}
