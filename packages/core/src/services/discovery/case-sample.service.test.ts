import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ValidationError } from "../../errors";
import { CaseSampleService } from "./case-sample.service";

const fixture = readFileSync(new URL("./__fixtures__/case-sample.csv", import.meta.url), "utf8");
const service = new CaseSampleService();
const HEADER = fixture.split("\n")[0] as string;
const fieldErrors = (csv: string): Record<string, string> => {
  try {
    service.analyze({ csv });
  } catch (error) {
    if (error instanceof ValidationError) return error.fields;
    throw error;
  }
  throw new Error("expected a ValidationError");
};

describe("CaseSampleService.analyze (hand-computed fixture)", () => {
  const report = service.analyze({ csv: fixture });

  it("counts the sample, period and resolution", () => {
    expect(report.sampleSize).toBe(12);
    expect(report.period).toEqual({ from: "2026-07", to: "2026-07" });
    expect(report.resolution).toMatchObject({ resolved: 11, open: 1 });
    expect(report.droppedColumns).toEqual([]);
  });

  it("follow-up share 9 of 12 and message statistics", () => {
    expect(report.followUp.share.value).toBe(0.75);
    expect(Math.round(report.followUp.share.low * 100)).toBe(47);
    expect(Math.round(report.followUp.share.high * 100)).toBe(91);
    expect(report.followUp).toMatchObject({ messagesMedian: 4, messagesP75: 6.25, followUpsMedian: 1 });
  });

  it("median days to resolve by kind, omitting kinds with no resolved case", () => {
    expect(report.resolution.daysMedianByKind).toEqual({ return: 3, complaint: 14, transport: 4.5 });
  });

  it("rule-settled share among all and among resolved cases", () => {
    const { baseline } = report.rules;
    expect(baseline.settledShare?.value).toBeCloseTo(7 / 12);
    expect([baseline.settledShare?.low, baseline.settledShare?.high].map((v) => Math.round((v ?? 0) * 100))).toEqual([32, 81]);
    expect(baseline.settledShareResolved?.value).toBeCloseTo(7 / 11);
    expect([baseline.settledShareResolved?.low, baseline.settledShareResolved?.high].map((v) => Math.round((v ?? 0) * 100))).toEqual([35, 85]);
    expect(baseline.matchedByRule).toEqual({ R08: 4, R09: 3, R10a: 2, R10b: 2, R10c: 2 });
  });

  it("agreement over the settled cases: cancelled counts as other, rejected as a false approval", () => {
    expect(report.rules.baseline.agreement).toEqual({ agrees: 5, falseApprovals: 1, other: 1 });
  });

  it("breakdowns", () => {
    expect(report.byKind.map((r) => [r.label, r.count, Math.round(r.share * 100)])).toEqual([
      ["return", 6, 50],
      ["complaint", 3, 25],
      ["transport", 2, 17],
      ["missing", 1, 8],
    ]);
    expect(report.byKind[0]?.valueMedian).toBe("150,00\u00a0zł");
    expect(report.byChannel.map((r) => [r.label, r.count])).toEqual([["mail", 8], ["phone", 4]]);
    expect(report.byOutcome.map((r) => [r.label, r.count])).toEqual([
      ["approved", 6], ["rejected", 2], ["partial", 2], ["cancelled", 1], ["open", 1],
    ]);
  });

  it("anonymises cases to C01…Cnn and never echoes case_ref", () => {
    expect(report.cases.map((c) => c.id)).toEqual(Array.from({ length: 12 }, (_, i) => `C${String(i + 1).padStart(2, "0")}`));
    const json = JSON.stringify(report);
    expect(json).not.toMatch(/"S\d\d"|S01|S12/);
    expect(report.cases[2]).toMatchObject({ rules: ["R08"], outcome: "rejected", daysToResolve: 5 });
    expect(report.cases[9]).toMatchObject({ daysToResolve: null, outcome: "open", rules: [] });
  });

  it("what-if R08 = 200 zł changes only the what-if block", () => {
    const tuned = service.analyze({ csv: fixture, thresholds: { R08: 20000 } });
    expect(tuned.rules.baseline).toEqual(report.rules.baseline);
    expect(tuned.rules.definitions).toEqual(report.rules.definitions);
    const w = tuned.rules.whatIf!;
    expect(w.matchedByRule).toEqual({ R08: 5, R09: 3, R10a: 2, R10b: 2, R10c: 2 });
    expect(w.settledShare?.value).toBeCloseTo(8 / 12);
    expect([w.settledShare?.low, w.settledShare?.high].map((v) => Math.round((v ?? 0) * 100))).toEqual([39, 86]);
    expect(w.agreement).toEqual({ agrees: 6, falseApprovals: 1, other: 1 });
    expect(w.definitions.find((d) => d.id === "R08")?.conditions).toContain("wartość ≤ 200,00\u00a0zł");
    expect(report.rules.whatIf).toBeNull();
  });

  it("rejects a what-if for a rule without a tunable threshold", () => {
    expect(() => service.analyze({ csv: fixture, thresholds: { R10c: 1 } as never })).toThrow(ValidationError);
  });

  it("shares are null for empty groups: a file with no resolved cases", () => {
    const csv = `${HEADER}\nA1,mail,return,home,"10,00",2026-07-01,,0,1,open`;
    const r = service.analyze({ csv });
    expect(r.rules.baseline.settledShareResolved).toBeNull();
    expect(r.resolution.daysMedianByKind).toEqual({});
    expect(r.rules.baseline.settledShare?.value).toBe(1);
  });

  it("includes the note", () => {
    expect(report.note).toContain("[DATA]");
  });
});

describe("CaseSampleService.analyze (rejections)", () => {
  it("reports bad rows by line and column, without values", () => {
    const errors = fieldErrors(`${HEADER}\nS1,mail,return,home,abc,2026-07-01,,0,1,open`);
    expect(errors).toHaveProperty(["row.2.value_pln"]);
    expect(JSON.stringify(errors)).not.toContain("abc");
  });

  it("lists at most 50 errors and counts the rest in `form`", () => {
    const rows = Array.from({ length: 60 }, (_, i) => `S${i},mail,return,home,abc,2026-07-01,,0,1,open`);
    const errors = fieldErrors([HEADER, ...rows].join("\n"));
    expect(Object.keys(errors).filter((k) => k.startsWith("row."))).toHaveLength(50);
    expect(errors.form).toBe("Jeszcze 10 błędów");
  });

  it("flags a duplicate case_ref on the second occurrence", () => {
    const row = "S1,mail,return,home,\"10,00\",2026-07-01,,0,1,open";
    expect(fieldErrors(`${HEADER}\n${row}\n${row}`)).toHaveProperty(["row.3.case_ref"]);
  });

  it("stops on personal data in a dropped column, naming the row not the value", () => {
    const csv = `${HEADER},contact\nS1,mail,return,home,"10,00",2026-07-01,,0,1,open,+48 600-123-456\nS2,mail,return,home,"10,00",2026-07-01,,0,1,open,jan@example.com`;
    const errors = fieldErrors(csv);
    expect(Object.keys(errors)).toEqual(["row.2", "row.3"]);
    expect(JSON.stringify(errors)).not.toMatch(/600|example/);
  });

  it("reports dropped columns by name", () => {
    const csv = `${HEADER},customer_name\nS1,mail,return,home,"10,00",2026-07-01,,0,1,open,Anonim`;
    expect(service.analyze({ csv }).droppedColumns).toEqual(["customer_name"]);
  });
});
