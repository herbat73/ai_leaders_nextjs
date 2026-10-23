import { describe, expect, it } from "vitest";

import type { ClaimFacts } from "../domain/claim-facts";
import { ValidationError } from "../errors";
import { BRIEF_RULES } from "./brief-rules";
import { describeRule } from "./describe";
import { evaluate } from "./evaluate";
import { ruleSchema, type Rule } from "./rule.schema";
import { simulate } from "./simulate";
import { withThresholds } from "./with-thresholds";

const facts = (kind: ClaimFacts["kind"], amountMinor: number, categories: ClaimFacts["categories"] = ["home"]): ClaimFacts => ({
  kind,
  value: { amountMinor, currency: "PLN" },
  categories,
});

const ids = (f: ClaimFacts, rules: Rule[] = BRIEF_RULES): string[] => evaluate(f, rules).map((m) => m.ruleId);

describe("evaluate", () => {
  it("matches value_lte at its boundary: 150.00 matches, 150.01 does not", () => {
    expect(ids(facts("return", 15000))).toEqual(["R08"]);
    expect(ids(facts("return", 15001))).toEqual([]);
  });

  it("matches value_gte at its boundary", () => {
    expect(ids(facts("return", 199999))).toEqual([]);
    expect(ids(facts("return", 200000))).toEqual(["R10c"]);
  });

  it("fires every matching rule, in order", () => {
    expect(ids(facts("transport", 250000))).toEqual(["R10a", "R10c"]);
    expect(ids(facts("transport", 4500))).toEqual(["R09", "R10a"]);
  });

  it("sorts by order, not by array position", () => {
    const reversed = [...BRIEF_RULES].reverse();
    expect(ids(facts("transport", 4500), reversed)).toEqual(["R09", "R10a"]);
  });

  it("skips disabled rules", () => {
    const rules = BRIEF_RULES.map((r) => (r.id === "R08" ? { ...r, enabled: false } : r));
    expect(ids(facts("return", 100), rules)).toEqual([]);
  });

  it("matches an empty `when`", () => {
    const rule: Rule = { schemaVersion: 1, id: "ALL", name: "all", enabled: true, order: 1, when: [], then: [{ type: "high_priority" }] };
    expect(ids(facts("missing", 1), [rule])).toEqual(["ALL"]);
  });

  it("category_in matches any item category", () => {
    expect(ids(facts("complaint", 9000, ["home", "appliances"]))).toEqual(["R10b"]);
    expect(ids(facts("complaint", 9000, ["home"]))).toEqual([]);
  });
});

describe("simulate", () => {
  it("counts matches per rule and settled cases (settling actions only)", () => {
    const result = simulate([facts("return", 100), facts("transport", 250000), facts("missing", 1)], BRIEF_RULES);
    expect(result.total).toBe(3);
    expect(result.matchedByRule).toMatchObject({ R08: 1, R10a: 1, R10c: 1, R09: 0 });
    expect(result.settled).toBe(1);
    expect(result.perCase).toHaveLength(3);
  });
});

describe("withThresholds", () => {
  it("replaces only the tunable value", () => {
    const next = withThresholds(BRIEF_RULES, { R08: 20000 });
    expect(next.find((r) => r.id === "R08")?.when).toContainEqual({ type: "value_lte", amountMinor: 20000, tunable: true });
    expect(next.find((r) => r.id === "R09")).toBe(BRIEF_RULES.find((r) => r.id === "R09"));
    expect(BRIEF_RULES[0]?.when).toContainEqual({ type: "value_lte", amountMinor: 15000, tunable: true });
  });

  it("rejects unknown or non-tunable ids", () => {
    expect(() => withThresholds(BRIEF_RULES, { NOPE: 1 })).toThrow(ValidationError);
    expect(() => withThresholds(BRIEF_RULES, { R10c: 1 })).toThrow(ValidationError);
  });
});

describe("describeRule", () => {
  it("settles only for auto_approve and keep_item", () => {
    const settling = BRIEF_RULES.filter((r) => describeRule(r).settles).map((r) => r.id);
    expect(settling).toEqual(["R08", "R09"]);
  });

  it("renders Polish text", () => {
    expect(describeRule(BRIEF_RULES[0]!)).toEqual({
      conditions: ["rodzaj: zwrot", "wartość ≤ 150,00\u00a0zł"],
      actions: ["automatyczna akceptacja"],
      settles: true,
    });
  });
});

describe("BRIEF_RULES", () => {
  it("parses with the schema, has descriptions and the R10a–R10c ids", () => {
    for (const rule of BRIEF_RULES) {
      expect(ruleSchema.safeParse(rule).success).toBe(true);
      expect(rule.name.length).toBeGreaterThan(0);
    }
    expect(BRIEF_RULES.map((r) => r.id)).toEqual(["R08", "R09", "R10a", "R10b", "R10c"]);
  });

  it("rejects a rule with no `then`", () => {
    expect(ruleSchema.safeParse({ ...BRIEF_RULES[0], then: [] }).success).toBe(false);
  });
});
