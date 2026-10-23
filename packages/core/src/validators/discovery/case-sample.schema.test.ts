import { describe, expect, it } from "vitest";

import { validateWith } from "../../http/parse";
import { MAX_CSV_BYTES, caseSampleAnalyzeSchema } from "./case-sample-analyze.schema";
import { caseSampleRowSchema, parseCaseDate } from "./case-sample-row.schema";

const valid = {
  case_ref: "S01",
  channel: "mail",
  kind: "return",
  category: "clothing",
  value_pln: "89,00",
  opened_on: "2026-07-01",
  resolved_on: "2026-07-04",
  follow_up_requests: "2",
  messages_exchanged: "5",
  outcome: "approved",
};

const errorsOf = (patch: Record<string, string>): Record<string, string> => {
  const result = validateWith(caseSampleRowSchema, { ...valid, ...patch });
  return result.success ? {} : result.fieldErrors;
};

describe("caseSampleRowSchema", () => {
  it("parses a valid row, both date formats, case-insensitive enums", () => {
    const result = validateWith(caseSampleRowSchema, { ...valid, channel: "MAIL", opened_on: "01.07.2026", resolved_on: "04.07.2026" });
    expect(result).toMatchObject({
      success: true,
      data: { channel: "mail", value_pln: { amountMinor: 8900 }, opened_on: "2026-07-01", resolved_on: "2026-07-04" },
    });
  });

  it("requires case_ref to start with a letter and fit 20 characters", () => {
    expect(errorsOf({ case_ref: "12345" })).toHaveProperty("case_ref");
    expect(errorsOf({ case_ref: "S" + "1".repeat(20) })).toHaveProperty("case_ref");
    expect(errorsOf({ case_ref: "S" + "1".repeat(19) })).toEqual({});
  });

  it("validates each column's edges", () => {
    expect(errorsOf({ channel: "fax" })).toHaveProperty("channel");
    expect(errorsOf({ kind: "x" })).toHaveProperty("kind");
    expect(errorsOf({ category: "x" })).toHaveProperty("category");
    expect(errorsOf({ value_pln: "-1" })).toHaveProperty("value_pln");
    expect(errorsOf({ value_pln: "1000000,01" })).toHaveProperty("value_pln");
    expect(errorsOf({ value_pln: "1000000,00" })).toEqual({});
    expect(errorsOf({ opened_on: "2026-02-30" })).toHaveProperty("opened_on");
    expect(errorsOf({ follow_up_requests: "51" })).toHaveProperty("follow_up_requests");
    expect(errorsOf({ follow_up_requests: "50" })).toEqual({});
    expect(errorsOf({ messages_exchanged: "201" })).toHaveProperty("messages_exchanged");
    expect(errorsOf({ messages_exchanged: "-1" })).toHaveProperty("messages_exchanged");
    expect(errorsOf({ outcome: "maybe" })).toHaveProperty("outcome");
  });

  it("keeps outcome and resolved_on consistent and dates ordered", () => {
    expect(errorsOf({ resolved_on: "", outcome: "approved" })).toHaveProperty("outcome");
    expect(errorsOf({ resolved_on: "", outcome: "open" })).toEqual({});
    expect(errorsOf({ outcome: "open" })).toHaveProperty("outcome");
    expect(errorsOf({ resolved_on: "2026-06-30" })).toHaveProperty("resolved_on");
    expect(errorsOf({ resolved_on: "2026-07-01" })).toEqual({});
  });

  it("never echoes the cell value in an error", () => {
    expect(JSON.stringify(errorsOf({ value_pln: "SECRET", case_ref: "999SECRET" }))).not.toContain("SECRET");
  });
});

describe("parseCaseDate", () => {
  it("accepts real dates only", () => {
    expect(parseCaseDate("29.02.2028")).toBe("2028-02-29");
    expect(parseCaseDate("29.02.2026")).toBeNull();
    expect(parseCaseDate("2026-7-1")).toBeNull();
  });
});

describe("caseSampleAnalyzeSchema", () => {
  it("measures the CSV limit in UTF-8 bytes, not characters", () => {
    expect(validateWith(caseSampleAnalyzeSchema, { csv: "a".repeat(MAX_CSV_BYTES) }).success).toBe(true);
    expect(validateWith(caseSampleAnalyzeSchema, { csv: "a".repeat(MAX_CSV_BYTES + 1) }).success).toBe(false);
    // 262 145 two-byte characters: under the limit in characters, over it in bytes
    const polish = "ł".repeat(MAX_CSV_BYTES / 2 + 1);
    expect(polish.length).toBeLessThan(MAX_CSV_BYTES);
    expect(validateWith(caseSampleAnalyzeSchema, { csv: polish }).success).toBe(false);
  });

  it("rejects a missing or empty csv", () => {
    expect(validateWith(caseSampleAnalyzeSchema, {}).success).toBe(false);
    expect(validateWith(caseSampleAnalyzeSchema, { csv: "" }).success).toBe(false);
  });

  it("parses R08/R09 thresholds to minor units and rejects anything else", () => {
    expect(validateWith(caseSampleAnalyzeSchema, { csv: "x", thresholds: { R08: "200,00", R09: "60" } })).toMatchObject({
      success: true,
      data: { thresholds: { R08: 20000, R09: 6000 } },
    });
    expect(validateWith(caseSampleAnalyzeSchema, { csv: "x", thresholds: { R10c: "5" } })).toMatchObject({
      success: false,
      fieldErrors: { "thresholds.R10c": expect.any(String) },
    });
    expect(validateWith(caseSampleAnalyzeSchema, { csv: "x", thresholds: { R08: "abc" } })).toMatchObject({
      success: false,
      fieldErrors: { "thresholds.R08": expect.any(String) },
    });
    expect(validateWith(caseSampleAnalyzeSchema, { csv: "x", thresholds: { R08: "1000000,01" } }).success).toBe(false);
  });
});
