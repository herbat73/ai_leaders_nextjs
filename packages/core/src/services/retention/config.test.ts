import { describe, expect, it } from "vitest";

import { ConfigurationError } from "../../errors";
import { DEFAULT_RETENTION_DAYS, parseRetentionDays } from "./config";

describe("parseRetentionDays", () => {
  it("defaults to one year when unset or blank", () => {
    expect(parseRetentionDays(undefined)).toBe(DEFAULT_RETENTION_DAYS);
    expect(parseRetentionDays(null)).toBe(365);
    expect(parseRetentionDays("  ")).toBe(365);
  });

  it("accepts whole numbers at and between the limits", () => {
    expect(parseRetentionDays("30")).toBe(30);
    expect(parseRetentionDays(" 730 ")).toBe(730);
    expect(parseRetentionDays("3650")).toBe(3650);
  });

  it.each(["29", "3651", "0", "-5", "1.5", "365d", "one year", "1e3"])("rejects %s instead of guessing", (raw) => {
    expect(() => parseRetentionDays(raw)).toThrow(ConfigurationError);
  });
});
