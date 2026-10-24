export interface RateRule {
  /** Maximum number of counted events per window. */
  limit: number;
  windowMs: number;
}

export interface RateDecision {
  allowed: boolean;
  /** 0 when allowed; otherwise milliseconds until the window resets. */
  retryAfterMs: number;
  remaining: number;
}

interface Window {
  count: number;
  endsAt: number;
}

export interface RateLimiterOptions {
  clock: () => Date;
  /** Maximum number of tracked keys; expired windows, then the oldest keys, are evicted at the cap. */
  maxKeys?: number;
}

const DEFAULT_MAX_KEYS = 10_000;

/**
 * Pure in-memory fixed-window limiter. A window starts at the first hit of a key and ends
 * `windowMs` later; at exactly the end instant the window has reset. Per process only.
 */
export class RateLimiter {
  private readonly clock: () => Date;
  private readonly maxKeys: number;
  private readonly windows = new Map<string, Window>();

  constructor({ clock, maxKeys = DEFAULT_MAX_KEYS }: RateLimiterOptions) {
    if (!Number.isInteger(maxKeys) || maxKeys < 1) throw new Error("maxKeys must be a positive integer");
    this.clock = clock;
    this.maxKeys = maxKeys;
  }

  /** Reports whether one more event would be allowed, without recording anything. */
  check(key: string, rule: RateRule): RateDecision {
    const now = this.clock().getTime();
    const current = this.live(key, now);
    return this.decide(current, rule, now);
  }

  /** Records one event unconditionally (e.g. a failed attempt) and returns the resulting state. */
  hit(key: string, rule: RateRule): RateDecision {
    const now = this.clock().getTime();
    let current = this.live(key, now);
    if (!current) {
      this.makeRoom(now);
      current = { count: 0, endsAt: now + rule.windowMs };
      this.windows.set(key, current);
    }
    current.count += 1;
    return this.decide(current, rule, now);
  }

  /** Checks and, only when allowed, records one event. */
  consume(key: string, rule: RateRule): RateDecision {
    const decision = this.check(key, rule);
    if (!decision.allowed) return decision;
    this.hit(key, rule);
    return { ...decision, remaining: decision.remaining - 1 };
  }

  /** Refunds one recorded event (a reservation that turned out not to count); no-op when the window already ended. */
  release(key: string): void {
    const current = this.live(key, this.clock().getTime());
    if (current && current.count > 0) current.count -= 1;
  }

  /** Number of tracked keys (including expired ones not yet evicted). */
  get size(): number {
    return this.windows.size;
  }

  private live(key: string, now: number): Window | undefined {
    const current = this.windows.get(key);
    if (current && now >= current.endsAt) {
      this.windows.delete(key);
      return undefined;
    }
    return current;
  }

  private decide(current: Window | undefined, rule: RateRule, now: number): RateDecision {
    const count = current?.count ?? 0;
    if (count >= rule.limit) {
      return { allowed: false, retryAfterMs: Math.max(0, (current?.endsAt ?? now) - now), remaining: 0 };
    }
    return { allowed: true, retryAfterMs: 0, remaining: rule.limit - count };
  }

  private makeRoom(now: number): void {
    if (this.windows.size < this.maxKeys) return;
    for (const [key, window] of this.windows) {
      if (now >= window.endsAt) this.windows.delete(key);
    }
    // Map iterates in insertion order, so the first keys are the oldest.
    for (const key of this.windows.keys()) {
      if (this.windows.size < this.maxKeys) break;
      this.windows.delete(key);
    }
  }
}

/** Trim, strip all whitespace and case-fold, so `ab-1`, `AB-1` and `AB-1 ` share one budget. */
export function normalizeOrderNumber(orderNumber: string): string {
  return orderNumber.replace(/\s+/g, "").toLowerCase();
}

export const CUSTOMER_RATE_RULES = {
  /** Lookups per client IP. */
  lookup: { limit: 10, windowMs: 60_000 },
  /** Failed attempts per (normalised order number, client IP). */
  failedAttempt: { limit: 5, windowMs: 10 * 60_000 },
  /** Quote and submit calls per session (keyed on the canonical order number). */
  session: { limit: 30, windowMs: 60_000 },
} as const satisfies Record<string, RateRule>;

export const rateKeys = {
  lookup: (ip: string): string => `lookup:${ip}`,
  failedAttempt: (orderNumber: string, ip: string): string =>
    `failed:${normalizeOrderNumber(orderNumber)}:${ip}`,
  quote: (canonicalOrderNumber: string): string => `quote:${canonicalOrderNumber}`,
  submit: (canonicalOrderNumber: string): string => `submit:${canonicalOrderNumber}`,
} as const;
