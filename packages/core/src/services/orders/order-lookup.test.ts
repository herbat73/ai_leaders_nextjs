import { describe, expect, it } from "vitest";
import { createFakeOrderLookup } from "../../adapters/orders/fake-order-lookup";
import { ConfigurationError } from "../../errors";
import { selectOrderSource } from "./order-source";
import { withLookupTimeout, type OrderLookup } from "./order-lookup.port";

const NOW = new Date("2026-10-23T10:00:00Z");
const fake = createFakeOrderLookup({ clock: () => NOW });

describe("fake order lookup", () => {
  it("finds an order with the right e-mail and computes deliveredAt from the clock", async () => {
    const result = await fake.lookup("PL-10001", "anna.kowalska@example.pl");
    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.order.lines.length).toBeGreaterThan(1);
    expect(result.order.deliveredAt).toEqual(new Date("2026-10-20T10:00:00Z"));
  });

  it("gives the identical result for a wrong e-mail and an unknown order", async () => {
    const wrongEmail = await fake.lookup("PL-10001", "ktos.inny@example.pl");
    const wrongOrder = await fake.lookup("PL-99999", "anna.kowalska@example.pl");
    expect(wrongEmail).toEqual({ status: "not_found" });
    expect(wrongOrder).toEqual(wrongEmail);
  });

  it("returns the canonical number for case, whitespace and e-mail case variants", async () => {
    const result = await fake.lookup("  pl-10001 ", "  Anna.Kowalska@Example.PL ");
    expect(result.status === "found" && result.order.orderNumber).toBe("PL-10001");
  });

  it("covers the seeded scenarios", async () => {
    const get = async (n: string) => {
      const r = await fake.getByNumber(n);
      if (r.status !== "found") throw new Error(n);
      return r.order;
    };
    expect((await get("PL-10002")).lines.some((l) => !l.returnable)).toBe(true);
    const old = await get("PL-10003");
    expect(NOW.getTime() - (old.deliveredAt as Date).getTime()).toBeGreaterThan(90 * 86400000);
    const undelivered = await get("PL-10004");
    expect(undelivered.deliveredAt).toBeNull();
    expect(undelivered.trackingUrl).toMatch(/^https:/);
    expect((await get("PL-10005")).lines.some((l) => l.quantity > 1)).toBe(true);
  });

  it("getByNumber needs no e-mail and returns not_found for an unknown number", async () => {
    const found = await fake.getByNumber(" pl-10002");
    expect(found.status === "found" && found.order.orderNumber).toBe("PL-10002");
    expect(await fake.getByNumber("PL-0")).toEqual({ status: "not_found" });
  });
});

describe("withLookupTimeout", () => {
  const slow: OrderLookup = {
    lookup: () => new Promise(() => undefined),
    getByNumber: () => new Promise(() => undefined),
  };
  const throwing: OrderLookup = {
    lookup: () => Promise.reject(new Error("boom")),
    getByNumber: () => {
      throw new Error("sync boom");
    },
  };

  it("yields unavailable for a slow adapter", async () => {
    const port = withLookupTimeout(slow, { timeoutMs: 10 });
    expect(await port.lookup("PL-10001", "a@b.pl")).toEqual({ status: "unavailable" });
    expect(await port.getByNumber("PL-10001")).toEqual({ status: "unavailable" });
  });

  it("yields unavailable for a throwing adapter", async () => {
    const port = withLookupTimeout(throwing, { timeoutMs: 50 });
    expect(await port.lookup("PL-10001", "a@b.pl")).toEqual({ status: "unavailable" });
    expect(await port.getByNumber("PL-10001")).toEqual({ status: "unavailable" });
  });

  it("passes a fast result through", async () => {
    const port = withLookupTimeout(fake, { timeoutMs: 50 });
    expect((await port.lookup("PL-10001", "anna.kowalska@example.pl")).status).toBe("found");
  });
});

describe("selectOrderSource", () => {
  it("defaults to fake in development and test", () => {
    expect(selectOrderSource({ nodeEnv: "development", source: undefined })).toBe("fake");
    expect(selectOrderSource({ nodeEnv: undefined, source: "" })).toBe("fake");
    expect(selectOrderSource({ nodeEnv: "test", source: "fake" })).toBe("fake");
  });

  it("fails closed in production", () => {
    expect(() => selectOrderSource({ nodeEnv: "production", source: "fake" })).toThrow(ConfigurationError);
    expect(() => selectOrderSource({ nodeEnv: "production", source: undefined })).toThrow(ConfigurationError);
  });

  it("rejects an unknown value", () => {
    expect(() => selectOrderSource({ nodeEnv: "development", source: "shopify" })).toThrow(ConfigurationError);
    expect(() => selectOrderSource({ nodeEnv: "production", source: "shopify" })).toThrow(ConfigurationError);
  });
});
