import { afterEach, describe, expect, it } from "vitest";

import { createTestDatabase, MIGRATIONS, type TestDatabase } from "../../test-support/postgres";
import { PostgresRateLimiter } from "./postgres-rate-limiter";

let db: TestDatabase | undefined;

afterEach(async () => {
  await db?.close();
  db = undefined;
});

const RULE = { limit: 3, windowMs: 60_000 };

async function setup(clock: () => Date): Promise<{ database: TestDatabase; limiter: PostgresRateLimiter }> {
  db = await createTestDatabase();
  await db.migrateUp();
  return { database: db, limiter: new PostgresRateLimiter({ orm: db.orm, clock }) };
}

describe("PostgresRateLimiter", () => {
  it("allows up to the limit, then answers retryAfter, and resets at the window end", async () => {
    let now = new Date("2026-11-02T10:00:00Z");
    const { limiter } = await setup(() => now);
    expect((await limiter.consume("k", RULE)).remaining).toBe(2);
    await limiter.consume("k", RULE);
    await limiter.consume("k", RULE);
    const denied = await limiter.consume("k", RULE);
    expect(denied).toEqual({ allowed: false, retryAfterMs: 60_000, remaining: 0 });
    now = new Date(now.getTime() + 60_000);
    expect((await limiter.consume("k", RULE)).allowed).toBe(true);
  });

  it("keeps budgets per key and refunds a released event", async () => {
    const now = new Date("2026-11-02T10:00:00Z");
    const { limiter } = await setup(() => now);
    for (let i = 0; i < 3; i += 1) await limiter.consume("a", RULE);
    expect((await limiter.consume("b", RULE)).allowed).toBe(true);
    expect((await limiter.consume("a", RULE)).allowed).toBe(false);
    await limiter.release("a");
    expect((await limiter.consume("a", RULE)).allowed).toBe(true);
  });

  it("survives a restart: a new limiter instance on the same database is still throttled", async () => {
    const now = new Date("2026-11-02T10:00:00Z");
    const { database, limiter } = await setup(() => now);
    for (let i = 0; i < 3; i += 1) await limiter.consume("login:1.2.3.4", RULE);
    const restarted = new PostgresRateLimiter({ orm: database.orm, clock: () => now });
    expect((await restarted.consume("login:1.2.3.4", RULE)).allowed).toBe(false);
  });

  it("never lets parallel requests exceed the limit", async () => {
    const now = new Date("2026-11-02T10:00:00Z");
    const { limiter } = await setup(() => now);
    const results = await Promise.all(Array.from({ length: 10 }, () => limiter.consume("p", RULE)));
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
  });
});

describe("Migration20261102120000", () => {
  it("creates and drops the table", async () => {
    db = await createTestDatabase();
    await db.migrateUp();
    expect((await db.query(`select to_regclass('rate_limit_windows') as t`))[0]).toEqual({ t: "rate_limit_windows" });
    await db.migrateDown(MIGRATIONS.supplierClaims);
    expect((await db.query(`select to_regclass('rate_limit_windows') as t`))[0]).toEqual({ t: null });
  });
});
