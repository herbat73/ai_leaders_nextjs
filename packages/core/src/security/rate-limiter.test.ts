import { describe, expect, it } from "vitest";
import { CUSTOMER_RATE_RULES, RateLimiter, normalizeOrderNumber, rateKeys } from "./rate-limiter";

function setup(maxKeys?: number) {
  let now = 1_000_000;
  const limiter = new RateLimiter({ clock: () => new Date(now), maxKeys });
  return { limiter, advance: (ms: number) => (now += ms) };
}

const rule = { limit: 2, windowMs: 1000 };

describe("RateLimiter", () => {
  it("allows up to the limit then denies with retryAfterMs", () => {
    const { limiter, advance } = setup();
    expect(limiter.consume("k", rule)).toMatchObject({ allowed: true, remaining: 1 });
    advance(100);
    expect(limiter.consume("k", rule).allowed).toBe(true);
    expect(limiter.consume("k", rule)).toEqual({ allowed: false, retryAfterMs: 900, remaining: 0 });
  });

  it("resets exactly at the window end, not before", () => {
    const { limiter, advance } = setup();
    limiter.consume("k", rule);
    limiter.consume("k", rule);
    advance(999);
    expect(limiter.consume("k", rule)).toMatchObject({ allowed: false, retryAfterMs: 1 });
    advance(1);
    expect(limiter.consume("k", rule).allowed).toBe(true);
  });

  it("check does not record; hit does", () => {
    const { limiter } = setup();
    for (let i = 0; i < 5; i++) expect(limiter.check("k", rule).allowed).toBe(true);
    expect(limiter.size).toBe(0);
    limiter.hit("k", rule);
    limiter.hit("k", rule);
    expect(limiter.check("k", rule).allowed).toBe(false);
  });

  it("denied consume does not extend or count", () => {
    const { limiter, advance } = setup();
    limiter.consume("k", rule);
    limiter.consume("k", rule);
    for (let i = 0; i < 10; i++) limiter.consume("k", rule);
    advance(1000);
    expect(limiter.consume("k", rule)).toMatchObject({ allowed: true, remaining: 1 });
  });

  it("keeps keys independent", () => {
    const { limiter } = setup();
    limiter.consume("a", { limit: 1, windowMs: 1000 });
    expect(limiter.consume("a", { limit: 1, windowMs: 1000 }).allowed).toBe(false);
    expect(limiter.consume("b", { limit: 1, windowMs: 1000 }).allowed).toBe(true);
  });

  it("evicts expired windows first when the cap is hit", () => {
    const { limiter, advance } = setup(3);
    limiter.hit("old", { limit: 1, windowMs: 100 });
    advance(50);
    limiter.hit("a", rule);
    limiter.hit("b", rule);
    advance(60); // "old" expired, a and b live
    limiter.hit("c", rule);
    expect(limiter.size).toBe(3);
    expect(limiter.check("a", rule).remaining).toBe(1);
    expect(limiter.check("b", rule).remaining).toBe(1);
  });

  it("evicts the oldest keys when nothing has expired", () => {
    const { limiter } = setup(2);
    const strict = { limit: 1, windowMs: 60_000 };
    limiter.hit("first", strict);
    limiter.hit("second", strict);
    limiter.hit("third", strict);
    expect(limiter.size).toBe(2);
    expect(limiter.check("first", strict).allowed).toBe(true); // evicted, budget gone
    expect(limiter.check("second", strict).allowed).toBe(false);
    expect(limiter.check("third", strict).allowed).toBe(false);
  });

  it("rejects an invalid cap", () => {
    expect(() => new RateLimiter({ clock: () => new Date(), maxKeys: 0 })).toThrow();
  });
});

describe("RateLimiter.release", () => {
  const rule = { limit: 2, windowMs: 1000 };

  it("refunds one recorded event and never goes below zero", () => {
    const limiter = new RateLimiter({ clock: () => new Date(0) });
    limiter.consume("k", rule);
    limiter.consume("k", rule);
    expect(limiter.check("k", rule).allowed).toBe(false);
    limiter.release("k");
    expect(limiter.check("k", rule).allowed).toBe(true);
    limiter.release("k");
    limiter.release("k");
    limiter.release("unknown");
    expect(limiter.check("k", rule).remaining).toBe(2);
  });
});

describe("normalizeOrderNumber", () => {
  it("trims, strips whitespace and case-folds", () => {
    expect(normalizeOrderNumber("  A B-1\t")).toBe("ab-1");
    expect(normalizeOrderNumber("ab-1")).toBe(normalizeOrderNumber("AB-1 "));
  });
});

describe("customer rules", () => {
  const { lookup, failedAttempt, session } = CUSTOMER_RATE_RULES;

  it("allows 10 lookups a minute per IP, then denies (429)", () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 10; i++) expect(limiter.consume(rateKeys.lookup("1.1.1.1"), lookup).allowed).toBe(true);
    const denied = limiter.consume(rateKeys.lookup("1.1.1.1"), lookup);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBe(60_000);
    expect(limiter.consume(rateKeys.lookup("2.2.2.2"), lookup).allowed).toBe(true);
    advance(60_000);
    expect(limiter.consume(rateKeys.lookup("1.1.1.1"), lookup).allowed).toBe(true);
  });

  it("shares one failed-attempt budget across the three spellings", () => {
    const { limiter, advance } = setup();
    const spellings = ["ab-1", "AB-1", "AB-1 ", "ab-1", "AB-1"];
    for (const s of spellings) {
      expect(limiter.check(rateKeys.failedAttempt(s, "1.1.1.1"), failedAttempt).allowed).toBe(true);
      limiter.hit(rateKeys.failedAttempt(s, "1.1.1.1"), failedAttempt);
    }
    expect(limiter.check(rateKeys.failedAttempt(" Ab-1", "1.1.1.1"), failedAttempt).allowed).toBe(false);
    // another IP and another order are unaffected
    expect(limiter.check(rateKeys.failedAttempt("ab-1", "2.2.2.2"), failedAttempt).allowed).toBe(true);
    expect(limiter.check(rateKeys.failedAttempt("ab-2", "1.1.1.1"), failedAttempt).allowed).toBe(true);
    advance(10 * 60_000);
    expect(limiter.check(rateKeys.failedAttempt("ab-1", "1.1.1.1"), failedAttempt).allowed).toBe(true);
  });

  it("does not count when only checking (unavailable results)", () => {
    const { limiter } = setup();
    const key = rateKeys.failedAttempt("ab-1", "1.1.1.1");
    for (let i = 0; i < 20; i++) expect(limiter.check(key, failedAttempt).allowed).toBe(true);
  });

  it("limits quote and submit to 30 a minute per session, independently", () => {
    const { limiter } = setup();
    for (let i = 0; i < 30; i++) expect(limiter.consume(rateKeys.quote("AB-1"), session).allowed).toBe(true);
    expect(limiter.consume(rateKeys.quote("AB-1"), session).allowed).toBe(false);
    expect(limiter.consume(rateKeys.quote("AB-2"), session).allowed).toBe(true);
    expect(limiter.consume(rateKeys.submit("AB-1"), session).allowed).toBe(true);
  });
});
