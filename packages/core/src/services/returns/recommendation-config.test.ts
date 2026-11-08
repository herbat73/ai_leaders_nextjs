import { describe, expect, it } from "vitest";

import { ConfigurationError } from "../../errors";
import { parseRulesRecommendationsFlag } from "./recommendation-config";

describe("parseRulesRecommendationsFlag", () => {
  it("is off when unset or blank", () => {
    expect(parseRulesRecommendationsFlag(undefined)).toBe(false);
    expect(parseRulesRecommendationsFlag(null)).toBe(false);
    expect(parseRulesRecommendationsFlag("  ")).toBe(false);
  });

  it("accepts on and off in any case", () => {
    expect(parseRulesRecommendationsFlag("on")).toBe(true);
    expect(parseRulesRecommendationsFlag(" ON ")).toBe(true);
    expect(parseRulesRecommendationsFlag("off")).toBe(false);
  });

  it("rejects anything else instead of silently staying off", () => {
    expect(() => parseRulesRecommendationsFlag("true")).toThrow(ConfigurationError);
    expect(() => parseRulesRecommendationsFlag("1")).toThrow(ConfigurationError);
  });
});
