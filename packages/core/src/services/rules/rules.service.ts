import type { ClaimFacts } from "../../domain/claim-facts";
import { BRIEF_RULES } from "../../rules/brief-rules";
import { describeRule } from "../../rules/describe";
import { settles, type Rule } from "../../rules/rule.schema";
import { simulate } from "../../rules/simulate";
import { withThresholds } from "../../rules/with-thresholds";
import type { RulesSimulateInput } from "../../validators/rules/rules-simulate.schema";
import type { RuleView, RulesRequestSource, RulesSimulation, RulesSimulationBlock } from "./types";

/** Upper bound on requests read for one what-if, so a huge table cannot stall the request. */
export const MAX_SIMULATED_REQUESTS = 5000;

function viewOf(rule: Rule): RuleView {
  const tunable = rule.when.find((c) => (c.type === "value_lte" || c.type === "value_gte") && c.tunable);
  return {
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    ...describeRule(rule),
    thresholdMinor: tunable && "amountMinor" in tunable ? tunable.amountMinor : null,
  };
}

function blockOf(facts: ClaimFacts[], rules: Rule[]): RulesSimulationBlock {
  const sim = simulate(facts, rules);
  return {
    settled: sim.settled,
    settledShare: sim.total === 0 ? null : sim.settled / sim.total,
    matchedByRule: sim.matchedByRule,
  };
}

/**
 * Read-only view of the brief rules (R08-R10) and a threshold what-if over the stored requests. Nothing is written:
 * the tried thresholds exist only for the length of the call.
 */
export class RulesService {
  private readonly returnRepository: RulesRequestSource;

  constructor(deps: { returnRepository: RulesRequestSource }) {
    this.returnRepository = deps.returnRepository;
  }

  listRules(): RuleView[] {
    return BRIEF_RULES.map(viewOf);
  }

  /** Facts are built like `recommend()` builds them (kind + resolution amount, no categories); no amount, no facts. */
  async simulateRules(input: RulesSimulateInput): Promise<RulesSimulation> {
    const requests = await this.returnRepository.list();
    const read = requests.slice(0, MAX_SIMULATED_REQUESTS);
    const facts: ClaimFacts[] = [];
    for (const request of read) {
      if (request.resolutionAmount) {
        facts.push({ kind: request.kind, value: request.resolutionAmount, categories: [] });
      }
    }

    const tuned = withThresholds(BRIEF_RULES, input.thresholds as Record<string, number>);
    return {
      total: facts.length,
      skipped: read.length - facts.length,
      truncated: requests.length > read.length,
      baseline: blockOf(facts, BRIEF_RULES),
      whatIf: blockOf(facts, tuned),
      definitions: tuned.map(viewOf),
    };
  }
}
