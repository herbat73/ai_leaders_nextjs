import type { ReturnRepository } from "../returns/types";

/** One rule as shown on the rules page; the text is Polish and built in `core` (`ui` has no strings). */
export interface RuleView {
  id: string;
  name: string;
  enabled: boolean;
  conditions: string[];
  actions: string[];
  settles: boolean;
  /** Current value threshold in minor units when the rule has a tunable one (R08, R09); otherwise `null`. */
  thresholdMinor: number | null;
}

export interface RulesSimulationBlock {
  /** Requests where at least one settling rule matched. */
  settled: number;
  /** `settled / total`, `null` when there is nothing to evaluate. */
  settledShare: number | null;
  matchedByRule: Record<string, number>;
}

export interface RulesSimulation {
  /** Requests evaluated (those with a resolution amount). */
  total: number;
  /** Requests left out because they carry no amount (exchanges, legacy rows). */
  skipped: number;
  /** True when more than the read limit exist: only the first `total + skipped` were evaluated. */
  truncated: boolean;
  baseline: RulesSimulationBlock;
  whatIf: RulesSimulationBlock;
  /** The rules with the tried thresholds applied. */
  definitions: RuleView[];
}

export type RulesRequestSource = Pick<ReturnRepository, "list">;
