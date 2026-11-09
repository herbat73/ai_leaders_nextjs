import { describe, expect, it } from "vitest";

import { RulesService, MAX_SIMULATED_REQUESTS } from "./rules.service";
import type { RulesRequestSource } from "./types";
import type { RequestKind, ReturnRequest } from "../returns/types";
import { rulesSimulateSchema } from "../../validators/rules/rules-simulate.schema";

function request(id: number, kind: RequestKind, amountMinor: number | null): ReturnRequest {
  return {
    id,
    rma: `RMA-2026-${String(id).padStart(5, "0")}`,
    kind,
    orderNumber: "ZAM-1",
    customerEmail: "a@example.pl",
    reason: null,
    status: "submitted",
    hasDecisionNote: false,
    resolutionAmount: amountMinor === null ? null : { amountMinor, currency: "PLN" },
    createdAt: new Date("2026-11-01T10:00:00Z"),
    updatedAt: new Date("2026-11-01T10:00:00Z"),
  };
}

function service(rows: ReturnRequest[]): { service: RulesService; calls: () => number; limits: () => (number | undefined)[] } {
  let calls = 0;
  const limits: (number | undefined)[] = [];
  // Like the repository: the cut happens in the source, so the service never sees more than it asked for.
  const source: RulesRequestSource = {
    list: async (_filter, options) => {
      calls += 1;
      limits.push(options?.limit);
      return options?.limit === undefined ? rows : rows.slice(0, options.limit);
    },
  };
  return { service: new RulesService({ returnRepository: source }), calls: () => calls, limits: () => limits };
}

describe("RulesService.listRules", () => {
  it("lists R08-R10c with Polish text and the current thresholds, without reading requests", () => {
    const { service: rules, calls } = service([]);
    const list = rules.listRules();
    expect(list.map((rule) => rule.id)).toEqual(["R08", "R09", "R10a", "R10b", "R10c"]);
    expect(list[0]).toMatchObject({ id: "R08", settles: true, thresholdMinor: 15000 });
    expect(list[0]?.conditions).toContain("rodzaj: zwrot");
    expect(list.find((rule) => rule.id === "R09")?.thresholdMinor).toBe(6000);
    expect(list.find((rule) => rule.id === "R10c")?.thresholdMinor).toBeNull();
    expect(calls()).toBe(0);
  });
});

describe("RulesService.simulateRules", () => {
  const rows = [
    request(1, "return", 10000),
    request(2, "return", 15000),
    request(3, "return", 15001),
    request(4, "complaint", 6000),
    request(5, "complaint", 6001),
    request(6, "return", null),
    request(7, "return", 250000),
  ];

  it("with no overrides baseline and what-if agree; amount-less requests are skipped", async () => {
    const result = await service(rows).service.simulateRules({ thresholds: {} });
    expect(result.total).toBe(6);
    expect(result.skipped).toBe(1);
    expect(result.truncated).toBe(false);
    expect(result.baseline.matchedByRule.R08).toBe(2); // 100,00 and 150,00 (boundary included)
    expect(result.baseline.matchedByRule.R09).toBe(1);
    expect(result.baseline.settled).toBe(3);
    expect(result.baseline.settledShare).toBe(0.5);
    expect(result.whatIf).toEqual(result.baseline);
  });

  it("a higher R08 threshold settles more, the baseline stays unchanged", async () => {
    const result = await service(rows).service.simulateRules({ thresholds: { R08: 20000 } });
    expect(result.baseline.matchedByRule.R08).toBe(2);
    expect(result.whatIf.matchedByRule.R08).toBe(3);
    expect(result.whatIf.settled).toBe(4);
    expect(result.definitions.find((rule) => rule.id === "R08")?.thresholdMinor).toBe(20000);
    expect(result.definitions.find((rule) => rule.id === "R08")?.conditions.join(";")).toMatch(/wartość ≤ 200,00/);
  });

  it("returns a null share for an empty table and rejects non-tunable rules", async () => {
    const { service: empty } = service([]);
    expect((await empty.simulateRules({ thresholds: {} })).baseline.settledShare).toBeNull();
    await expect(empty.simulateRules({ thresholds: { R10c: 1 } as never })).rejects.toMatchObject({ status: 400 });
  });

  it("evaluates at most MAX_SIMULATED_REQUESTS and says so", async () => {
    const many = Array.from({ length: MAX_SIMULATED_REQUESTS + 3 }, (_, i) => request(i + 1, "return", 100));
    const result = await service(many).service.simulateRules({ thresholds: {} });
    expect(result.total).toBe(MAX_SIMULATED_REQUESTS);
    expect(result.truncated).toBe(true);
  });

  it("asks the source for the cap plus one row, so the cut is made in the database (#119)", async () => {
    const many = Array.from({ length: MAX_SIMULATED_REQUESTS + 3 }, (_, i) => request(i + 1, "return", 100));
    const { service: rules, limits } = service(many);
    await rules.simulateRules({ thresholds: {} });
    expect(limits()).toEqual([MAX_SIMULATED_REQUESTS + 1]);
  });

  it("is not truncated at exactly the cap, truncated one row above it", async () => {
    const exact = Array.from({ length: MAX_SIMULATED_REQUESTS }, (_, i) => request(i + 1, "return", 100));
    expect((await service(exact).service.simulateRules({ thresholds: {} })).truncated).toBe(false);
    const above = [...exact, request(MAX_SIMULATED_REQUESTS + 1, "return", 100)];
    expect((await service(above).service.simulateRules({ thresholds: {} })).truncated).toBe(true);
  });
});

describe("rulesSimulateSchema", () => {
  it("parses text amounts into minor units", () => {
    expect(rulesSimulateSchema.parse({ thresholds: { R08: "200,00", R09: "75" } })).toEqual({
      thresholds: { R08: 20000, R09: 7500 },
    });
    expect(rulesSimulateSchema.parse({ thresholds: {} })).toEqual({ thresholds: {} });
  });

  it("rejects other rules, junk and amounts above 1 000 000 zł", () => {
    expect(rulesSimulateSchema.safeParse({ thresholds: { R10c: "10" } }).success).toBe(false);
    expect(rulesSimulateSchema.safeParse({ thresholds: { R08: "abc" } }).success).toBe(false);
    expect(rulesSimulateSchema.safeParse({ thresholds: { R08: "1000000,01" } }).success).toBe(false);
    expect(rulesSimulateSchema.safeParse({}).success).toBe(false);
  });
});
