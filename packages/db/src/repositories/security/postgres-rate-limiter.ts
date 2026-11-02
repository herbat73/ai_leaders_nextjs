import type { MikroORM } from "@mikro-orm/postgresql";
import type { RateDecision, RateLimiterPort, RateRule } from "@easyrms/core";

export interface PostgresRateLimiterOptions {
  orm: MikroORM;
  clock: () => Date;
}

/** Every this-many calls, expired windows are deleted so the table stays small. */
const PRUNE_EVERY = 200;

interface WindowRow {
  count: number;
  ends_at: Date | string;
}

/**
 * Fixed-window limiter in Postgres, same semantics as the in-memory `RateLimiter` (a window starts at the first hit of
 * a key and has reset at exactly its end instant). Each operation is one atomic statement, so parallel requests and
 * several instances cannot all pass the check first.
 */
export class PostgresRateLimiter implements RateLimiterPort {
  private readonly orm: MikroORM;
  private readonly clock: () => Date;
  private calls = 0;

  constructor({ orm, clock }: PostgresRateLimiterOptions) {
    this.orm = orm;
    this.clock = clock;
  }

  /** Records one event only when the budget allows it. */
  async consume(key: string, rule: RateRule): Promise<RateDecision> {
    const now = this.clock();
    const endsAt = new Date(now.getTime() + rule.windowMs);
    const rows = await this.execute(
      `insert into "rate_limit_windows" ("key", "count", "ends_at") values (?, 1, ?)
       on conflict ("key") do update set
         "count" = case when "rate_limit_windows"."ends_at" <= ? then 1 else "rate_limit_windows"."count" + 1 end,
         "ends_at" = case when "rate_limit_windows"."ends_at" <= ? then excluded."ends_at" else "rate_limit_windows"."ends_at" end
       where "rate_limit_windows"."ends_at" <= ? or "rate_limit_windows"."count" < ?
       returning "count", "ends_at"`,
      [key, endsAt, now, now, now, rule.limit],
    );
    void this.prune(now);
    if (rows.length > 0) return { allowed: true, retryAfterMs: 0, remaining: Math.max(0, rule.limit - rows[0].count) };

    const [current] = await this.execute(`select "count", "ends_at" from "rate_limit_windows" where "key" = ?`, [key]);
    const retryAfterMs = current ? Math.max(0, new Date(current.ends_at).getTime() - now.getTime()) : rule.windowMs;
    return { allowed: false, retryAfterMs, remaining: 0 };
  }

  /** Refunds one recorded event; a no-op when the window already ended. */
  async release(key: string): Promise<void> {
    await this.execute(`update "rate_limit_windows" set "count" = "count" - 1 where "key" = ? and "ends_at" > ? and "count" > 0`, [
      key,
      this.clock(),
    ]);
  }

  private async prune(now: Date): Promise<void> {
    this.calls += 1;
    if (this.calls % PRUNE_EVERY !== 0) return;
    try {
      await this.execute(`delete from "rate_limit_windows" where "ends_at" <= ?`, [now]);
    } catch {
      // Housekeeping only: a failed prune must never fail a login.
    }
  }

  private execute(sql: string, params: unknown[]): Promise<WindowRow[]> {
    return this.orm.em.getConnection().execute(sql, params) as Promise<WindowRow[]>;
  }
}
