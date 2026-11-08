import { describe, expect, it } from "vitest";

import { money } from "../../domain/money";
import { BRIEF_RULES, withThresholds } from "../../rules";
import { compareDecision, NO_RECOMMENDATION, recommend } from "./recommendation";

const ret = (zl: number) => ({ kind: "return" as const, resolutionAmount: money(zl * 100) });
const complaint = (zl: number) => ({ kind: "complaint" as const, resolutionAmount: money(zl * 100) });

describe("recommend", () => {
  it("recommends approval for a return up to 150 zł (R08), boundary included", () => {
    expect(recommend(ret(150), BRIEF_RULES)).toMatchObject({ recommended: "approve", ruleIds: ["R08"], keepItem: false });
    expect(recommend({ kind: "return", resolutionAmount: money(15001) }, BRIEF_RULES).recommended).toBe("none");
  });

  it("recommends keeping the item for a complaint up to 60 zł (R09), boundary included", () => {
    expect(recommend(complaint(60), BRIEF_RULES)).toMatchObject({ recommended: "approve", ruleIds: ["R09"], keepItem: true });
    expect(recommend({ kind: "complaint", resolutionAmount: money(6001) }, BRIEF_RULES).recommended).toBe("none");
  });

  it("does not apply R08 to a complaint or R09 to a return", () => {
    expect(recommend(complaint(100), BRIEF_RULES).recommended).toBe("none");
    expect(recommend(ret(50), BRIEF_RULES).ruleIds).toEqual(["R08"]);
  });

  it("hints at a manager from 2000 zł (R10c) without recommending approval", () => {
    const result = recommend(ret(2000), BRIEF_RULES);
    expect(result).toMatchObject({ recommended: "none", assignManager: true, ruleIds: [] });
    expect(result.rules).toEqual([{ id: "R10c", name: expect.any(String) }]);
  });

  it("never flags high priority for return and complaint requests (R10a needs a transport kind)", () => {
    expect(recommend(ret(10), BRIEF_RULES).highPriority).toBe(false);
    expect(recommend(complaint(10), BRIEF_RULES).highPriority).toBe(false);
  });

  it("gives no recommendation without a resolution amount (exchange, legacy rows)", () => {
    expect(recommend({ kind: "return", resolutionAmount: null }, BRIEF_RULES)).toBe(NO_RECOMMENDATION);
    expect(recommend({ kind: "return" }, BRIEF_RULES)).toBe(NO_RECOMMENDATION);
  });

  it("ignores disabled rules and follows overridden thresholds", () => {
    const disabled = BRIEF_RULES.map((rule) => (rule.id === "R08" ? { ...rule, enabled: false } : rule));
    expect(recommend(ret(10), disabled).recommended).toBe("none");
    const tuned = withThresholds(BRIEF_RULES, { R08: 20000 });
    expect(recommend(ret(180), tuned).recommended).toBe("approve");
  });
});

describe("compareDecision", () => {
  const approve = recommend(ret(100), BRIEF_RULES);

  it("marks approving a recommended approval as followed and rejecting it as not followed", () => {
    expect(compareDecision(approve, "approved")).toEqual({ recommended: "approve", ruleIds: ["R08"], actualStatus: "approved", followed: true });
    expect(compareDecision(approve, "rejected")).toMatchObject({ followed: false, actualStatus: "rejected" });
  });

  it("stores followed as null when nothing was recommended", () => {
    expect(compareDecision(NO_RECOMMENDATION, "approved")).toEqual({ recommended: "none", ruleIds: [], actualStatus: "approved", followed: null });
  });

  it("records only approve and reject decisions", () => {
    expect(compareDecision(approve, "received")).toBeNull();
    expect(compareDecision(approve, "in_transit")).toBeNull();
  });
});
