import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ConflictError,
  createFakeOrderLookup,
  money,
  RateLimiter,
  ReturnService,
  type ApiLogger,
  type NewReturnRequest,
  type ReturnRepository,
} from "@easyrms/core";

import { MikroOrmReturnRepository } from "../repositories/returns/return.repository";
import { createTestDatabase, type TestDatabase } from "../test-support/postgres";

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.migrateUp();
});

afterAll(async () => {
  await db?.close();
});

const logger = (): ApiLogger => ({ error: vi.fn<ApiLogger["error"]>() });
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Own fork per call: a separate identity map and, once a transaction opens, a separate connection. */
class RecordingRepository extends MikroOrmReturnRepository {
  static readonly lockKeys: string[] = [];

  constructor() {
    super({ em: db.fork(), logger: logger() });
  }

  override withOrderLock<T>(orderNumber: string, fn: (tx: ReturnRepository) => Promise<T>): Promise<T> {
    RecordingRepository.lockKeys.push(orderNumber);
    return super.withOrderLock(orderNumber, fn);
  }
}

const repository = (): MikroOrmReturnRepository => new MikroOrmReturnRepository({ em: db.fork(), logger: logger() });

function input(order: string, overrides: Partial<NewReturnRequest> = {}): NewReturnRequest {
  return {
    orderNumber: order,
    customerEmail: "c@example.com",
    items: [{ lineRef: "L1", sku: "SKU-1", name: "Shoe", quantity: 1, unitPrice: money(19990), reasonCode: "size" }],
    resolution: "refund",
    resolutionAmount: money(19990),
    returnMethod: "courier",
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

/** The in-lock part of `ReturnService.submit`, with a pause between the check and the insert to widen the race. */
async function submitLike(order: string, idempotencyKey: string, events: string[], label: string): Promise<string> {
  return repository().withOrderLock(order, async (tx) => {
    events.push(`${label}:in`);
    if (await tx.findByIdempotencyKey(idempotencyKey)) throw new Error("unexpected replay");
    const claimed = await tx.claimedQuantities(order);
    if ((claimed.L1 ?? 0) >= 1) throw new ConflictError("Some items were claimed by another request");
    await sleep(150);
    const created = await tx.createWithItems(input(order, { idempotencyKey }));
    events.push(`${label}:out`);
    return created.rma;
  });
}

describe("two submits for one order line", () => {
  it("yield exactly one request and one conflict, serialised by the advisory lock", async () => {
    const events: string[] = [];
    const results = await Promise.allSettled([
      submitLike("RACE-1", randomUUID(), events, "a"),
      submitLike("RACE-1", randomUUID(), events, "b"),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(ConflictError);
    expect(await db.query(`select 1 from "return_requests" where "order_number" = 'RACE-1'`)).toHaveLength(1);
    // The second caller entered only after the first one left (its in-lock read saw the committed row).
    const first = events[0]?.split(":")[0];
    expect(events.slice(0, 2)).toEqual([`${first}:in`, `${first}:out`]);
  });

  it("serialise many racers for one line: still exactly one wins", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) => submitLike("RACE-N", randomUUID(), [], `r${index}`)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(5);
    expect(await db.query(`select 1 from "return_requests" where "order_number" = 'RACE-N'`)).toHaveLength(1);
  });

  it("let different orders proceed in parallel", async () => {
    const started = Date.now();
    await Promise.all([submitLike("PAR-A", randomUUID(), [], "a"), submitLike("PAR-B", randomUUID(), [], "b")]);
    expect(await db.query(`select 1 from "return_requests" where "order_number" in ('PAR-A', 'PAR-B')`)).toHaveLength(2);
    // Two 150 ms pauses overlapped; serialised they would take at least 300 ms.
    expect(Date.now() - started).toBeLessThan(290);
  });
});

describe("the same idempotency key from two different orders", () => {
  it("yields one row and a ConflictError, never an unmapped error", async () => {
    const key = randomUUID();
    await repository().createWithItems(input("KEY-1", { idempotencyKey: key }));
    await expect(repository().createWithItems(input("KEY-2", { idempotencyKey: key }))).rejects.toBeInstanceOf(ConflictError);
    expect(await db.query(`select 1 from "return_requests" where "idempotency_key" = ?`, [key])).toHaveLength(1);
  });

  it("holds when both orders race under their own, different locks", async () => {
    const key = randomUUID();
    const results = await Promise.allSettled([
      submitLike("KEY-RACE-A", key, [], "a"),
      submitLike("KEY-RACE-B", key, [], "b"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(ConflictError);
    expect(await db.query(`select 1 from "return_requests" where "idempotency_key" = ?`, [key])).toHaveLength(1);
  });
});

describe("the advisory lock key", () => {
  const heldFor = (key: string) =>
    db.query<{ held: boolean }>(
      `select exists (select 1 from "pg_locks" where "locktype" = 'advisory' and "granted" and "objsubid" = 1 and "objid"::text::bigint = (hashtext(?)::bigint & 4294967295)) as "held"`,
      [key],
    );

  it("is hashtext of exactly the order number passed in", async () => {
    const seen = await repository().withOrderLock("KEY-LOCK-1", async () => ({
      same: (await heldFor("KEY-LOCK-1"))[0]?.held,
      variant: (await heldFor("key-lock-1"))[0]?.held,
    }));
    expect(seen).toEqual({ same: true, variant: false });
  });
});

describe("a case-variant order number (S8)", () => {
  it("never reaches the repository: every submit locks, stores and compares the canonical number", async () => {
    RecordingRepository.lockKeys.length = 0;
    const service = new ReturnService({
      returnRepository: new RecordingRepository(),
      clock: () => new Date(),
      mailPort: { send: () => undefined },
      logger: logger(),
      orderLookup: createFakeOrderLookup({ clock: () => new Date() }),
      rateLimiter: new RateLimiter({ clock: () => new Date() }),
      eligibilityConfig: { windowDays: 30 },
      quoteConfig: { shippingFee: money(1000) },
      approvalConfig: { refundApprovalLimit: money(200000) },
    });
    const body = (idempotencyKey: string) => ({
      items: [{ lineRef: "L1", quantity: 1, reasonCode: "size" as const }],
      resolution: "refund" as const,
      returnMethod: "courier" as const,
      acknowledged: true as const,
      idempotencyKey,
    });

    const results = await Promise.allSettled([
      service.submit("pl-10001", body(randomUUID())),
      service.submit("  Pl-10001 ", body(randomUUID())),
      service.submit("PL-10001", body(randomUUID())),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const failed of results.filter((r): r is PromiseRejectedResult => r.status === "rejected")) {
      expect(failed.reason).toMatchObject({ status: 409, code: "conflict" });
    }
    expect(RecordingRepository.lockKeys.length).toBeGreaterThan(0);
    expect(new Set(RecordingRepository.lockKeys)).toEqual(new Set(["PL-10001"]));
    const rows = await db.query<{ order_number: string }>(`select "order_number" from "return_requests" where "order_number" ilike 'pl-10001'`);
    expect(rows).toEqual([{ order_number: "PL-10001" }]);
  });
});
