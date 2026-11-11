import { describe, expect, it } from "vitest";

import { ConflictError, NotFoundError } from "../../errors";
import { RetentionService } from "./retention.service";
import type { AnonymizeCounts, RetentionPort, RetentionTarget } from "./types";

const NOW = new Date("2026-11-11T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function target(id: number, over: Partial<RetentionTarget> = {}): RetentionTarget {
  return { id, rma: `RMA-${id}`, status: "resolved", anonymizedAt: null, ...over };
}

function setup(options: { due?: RetentionTarget[]; byRma?: RetentionTarget[]; failIds?: number[]; days?: number } = {}) {
  const calls = { findDue: [] as { cutoff: Date; limit: number; afterId: number }[], anonymized: [] as number[], purge: [] as Date[] };
  const errors: { message: string; context?: Record<string, unknown> }[] = [];
  const port: RetentionPort = {
    async findDue(cutoff, limit, afterId) {
      calls.findDue.push({ cutoff, limit, afterId });
      return (options.due ?? []).filter((row) => row.id > afterId).slice(0, limit);
    },
    async findByRma(rma) {
      return (options.byRma ?? []).find((row) => row.rma === rma) ?? null;
    },
    async anonymize(id): Promise<AnonymizeCounts> {
      if (options.failIds?.includes(id)) throw new Error("lock timeout");
      calls.anonymized.push(id);
      return { files: 2, auditRows: 3 };
    },
    async purgeOrphanAudit(cutoff) {
      calls.purge.push(cutoff);
      return 4;
    },
  };
  const service = new RetentionService({
    retentionPort: port,
    clock: () => NOW,
    logger: { error: (message, context) => errors.push({ message, context }) },
    retentionDays: options.days ?? 365,
  });
  return { service, calls, errors };
}

describe("RetentionService.run", () => {
  it("anonymizes every due request and sums the counts", async () => {
    const { service, calls } = setup({ due: [target(1), target(2)] });
    const result = await service.run();
    expect(calls.anonymized).toEqual([1, 2]);
    expect(result).toMatchObject({ dryRun: false, requests: 2, files: 4, auditRows: 6, orphanAuditRows: 4, rmas: ["RMA-1", "RMA-2"], failed: [] });
  });

  it("computes the cutoff from the configured number of days", async () => {
    const { service, calls } = setup({ days: 30 });
    const result = await service.run();
    expect(result.cutoff.getTime()).toBe(NOW.getTime() - 30 * DAY);
    expect(calls.findDue[0].cutoff).toEqual(result.cutoff);
    expect(calls.purge[0]).toEqual(result.cutoff);
  });

  it("changes nothing in a dry run and lists the RMA numbers", async () => {
    const { service, calls } = setup({ due: [target(1), target(2)] });
    const result = await service.run({ dryRun: true });
    expect(calls.anonymized).toEqual([]);
    expect(calls.purge).toEqual([]);
    expect(result).toMatchObject({ dryRun: true, requests: 2, files: 0, rmas: ["RMA-1", "RMA-2"] });
  });

  it("walks through batches of 100 without repeating a request", async () => {
    const due = Array.from({ length: 250 }, (_, index) => target(index + 1));
    const { service, calls } = setup({ due });
    const result = await service.run();
    expect(result.requests).toBe(250);
    expect(calls.findDue.map((call) => call.afterId)).toEqual([0, 100, 200, 250]);
  });

  it("isolates a failing request: the rest continue, the failure is logged without personal data", async () => {
    const { service, calls, errors } = setup({ due: [target(1), target(2), target(3)], failIds: [2] });
    const result = await service.run();
    expect(calls.anonymized).toEqual([1, 3]);
    expect(result.failed).toEqual([{ id: 2, rma: "RMA-2" }]);
    expect(errors).toHaveLength(1);
    expect(Object.keys(errors[0].context ?? {}).sort()).toEqual(["error", "requestId", "rma"]);
  });

  it("does nothing when nothing is due", async () => {
    const { service } = setup();
    expect(await service.run()).toMatchObject({ requests: 0, files: 0, rmas: [] });
  });
});

describe("RetentionService.eraseOne", () => {
  it("erases a closed request", async () => {
    const { service, calls } = setup({ byRma: [target(7)] });
    expect(await service.eraseOne("RMA-7")).toEqual({ rma: "RMA-7", alreadyErased: false, files: 2, auditRows: 3 });
    expect(calls.anonymized).toEqual([7]);
  });

  it("answers not found for an unknown RMA", async () => {
    const { service } = setup();
    await expect(service.eraseOne("RMA-404")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses a request that is not closed unless forced", async () => {
    const { service, calls } = setup({ byRma: [target(8, { status: "submitted" })] });
    await expect(service.eraseOne("RMA-8")).rejects.toBeInstanceOf(ConflictError);
    expect(calls.anonymized).toEqual([]);
    expect((await service.eraseOne("RMA-8", { force: true })).alreadyErased).toBe(false);
    expect(calls.anonymized).toEqual([8]);
  });

  it("does not repeat an erasure", async () => {
    const { service, calls } = setup({ byRma: [target(9, { anonymizedAt: NOW })] });
    expect(await service.eraseOne("RMA-9")).toMatchObject({ alreadyErased: true, files: 0 });
    expect(calls.anonymized).toEqual([]);
  });
});
