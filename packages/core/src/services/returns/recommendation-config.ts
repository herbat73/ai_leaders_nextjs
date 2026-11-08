import { ConfigurationError } from "../../errors";
import { BRIEF_RULES, type Rule } from "../../rules";

export interface RecommendationConfig {
  /** Off by default: no recommendation is computed, shown or stored. */
  enabled: boolean;
  rules: Rule[];
}

export const RECOMMENDATIONS_OFF: RecommendationConfig = { enabled: false, rules: BRIEF_RULES };

/** Parses `EASYRMS_RULES_RECOMMENDATIONS` (core never reads env): unset or blank is off; `on` / `off` (any case); anything else is a configuration error. */
export function parseRulesRecommendationsFlag(raw: string | null | undefined): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "" || value === "off") return false;
  if (value === "on") return true;
  throw new ConfigurationError("EASYRMS_RULES_RECOMMENDATIONS must be 'on' or 'off'");
}
