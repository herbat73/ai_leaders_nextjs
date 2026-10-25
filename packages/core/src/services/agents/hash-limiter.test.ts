import { describe, expect, it } from "vitest";
import { BusyError, limitHashConcurrency } from "./hash-limiter";
import type { PasswordHasher } from "./password-hasher";

function gatedHasher() {
  const gates: (() => void)[] = [];
  let started = 0;
  const wait = () =>
    new Promise<void>((resolve) => {
      started += 1;
      gates.push(resolve);
    });
  const hasher: PasswordHasher = {
    hash: async (password) => {
      await wait();
      return `h:${password}`;
    },
    verify: async (password, stored) => {
      await wait();
      return stored === `h:${password}`;
    },
    needsRehash: () => false,
  };
  return { hasher, release: () => gates.splice(0).forEach((open) => open()), started: () => started };
}

describe("limitHashConcurrency", () => {
  it("answers 503 busy beyond the cap without starting another hash", async () => {
    const { hasher, release, started } = gatedHasher();
    const limited = limitHashConcurrency(hasher, 2);

    const first = limited.hash("a");
    const second = limited.verify("b", "h:b");
    await expect(limited.hash("c")).rejects.toMatchObject({ status: 503, code: "busy" });
    expect(started()).toBe(2);

    release();
    await expect(first).resolves.toBe("h:a");
    await expect(second).resolves.toBe(true);
  });

  it("frees a slot when a hash fails, and when it finishes", async () => {
    const failing: PasswordHasher = {
      hash: async () => {
        throw new Error("boom");
      },
      verify: async () => true,
      needsRehash: () => false,
    };
    const limited = limitHashConcurrency(failing, 1);
    await expect(limited.hash("a")).rejects.toThrow("boom");
    await expect(limited.hash("a")).rejects.toThrow("boom");
    await expect(limited.verify("a", "x")).resolves.toBe(true);
  });

  it("passes needsRehash through and rejects an invalid cap", () => {
    const { hasher } = gatedHasher();
    expect(limitHashConcurrency(hasher, 1).needsRehash("x")).toBe(false);
    expect(() => limitHashConcurrency(hasher, 0)).toThrow();
    expect(new BusyError().status).toBe(503);
  });
});
