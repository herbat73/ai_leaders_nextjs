import { describe, expect, it } from "vitest";

import { createFakeOrderLookup } from "../../adapters/orders/fake-order-lookup";
import { money } from "../../domain/money";
import { AppError, NotFoundError, TooManyRequestsError, UnauthorizedError, ValidationError } from "../../errors";
import { serializeClearedCookie, readCookie } from "../../http/cookies";
import { RateLimiter } from "../../security/rate-limiter";
import { returnLookupSchema } from "../../validators/returns/return-lookup.schema";
import { returnQuoteSchema } from "../../validators/returns/return-quote.schema";
import type { OrderLookup, OrderLookupResult } from "../orders/order-lookup.port";
import { GuestSessionService, requireGuestSession } from "./guest-session.service";
import { ReturnLookupService, LOOKUP_NOT_FOUND_MESSAGE } from "./return-lookup.service";
import { ReturnService } from "./return.service";
import type { ReturnDetail, ReturnRepository, ReturnRequest } from "./types";

const NOW = new Date("2026-11-05T10:00:00Z");
const SECRET = "x".repeat(40);
const ANNA = { orderNumber: "PL-10001", email: "anna.kowalska@example.pl" };
const IP = "203.0.113.7";

function makeRequest(overrides: Partial<ReturnRequest> = {}): ReturnRequest {
  return {
    id: 1,
    rma: "RMA-2026-00001",
    kind: "return",
    orderNumber: "PL-10001",
    customerEmail: ANNA.email,
    reason: null,
    status: "submitted",
    hasDecisionNote: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeRepository(rows: ReturnRequest[] = [], claimed: Record<string, Record<string, number>> = {}): ReturnRepository {
  const unsupported = (): never => {
    throw new Error("not implemented in this fake");
  };
  return {
    list: async () => rows,
    findDetail: async () => null,
    findStatus: async () => null,
    createWithItems: unsupported,
    listByOrder: async (orderNumber) => rows.filter((row) => row.orderNumber === orderNumber),
    findByRma: async (rma): Promise<ReturnDetail | null> => {
      const request = rows.find((row) => row.rma === rma);
      return request ? { request, decisionNote: null, items: [], events: [] } : null;
    },
    findByIdempotencyKey: async () => null,
    claimedQuantities: async (orderNumber) => claimed[orderNumber] ?? {},
    withOrderLock: unsupported,
    transition: unsupported,
  };
}

function setup(options: { port?: OrderLookup; rows?: ReturnRequest[]; claimed?: Record<string, Record<string, number>> } = {}) {
  const clock = (): Date => NOW;
  const repository = makeRepository(options.rows, options.claimed);
  const guest = new GuestSessionService({ secret: SECRET, ttlSeconds: 7200, clock });
  const service = new ReturnLookupService({
    returnRepository: repository,
    orderLookup: options.port ?? createFakeOrderLookup({ clock }),
    rateLimiter: new RateLimiter({ clock }),
    guestSessionService: guest,
    clock,
    eligibilityConfig: { windowDays: 30 },
    quoteConfig: { shippingFee: money(1000) },
  });
  const returns = new ReturnService({
    returnRepository: repository,
    clock,
    mailPort: { send: () => undefined },
    logger: { error: () => undefined },
    orderLookup: options.port ?? createFakeOrderLookup({ clock }),
    rateLimiter: new RateLimiter({ clock }),
    eligibilityConfig: { windowDays: 30 },
    quoteConfig: { shippingFee: money(1000) },
  });
  return { service, guest, returns };
}

async function failure(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("expected an AppError");
}

const unavailablePort = (): OrderLookup => ({
  lookup: async (): Promise<OrderLookupResult> => ({ status: "unavailable" }),
  getByNumber: async (): Promise<OrderLookupResult> => ({ status: "unavailable" }),
});

describe("ReturnLookupService.lookup", () => {
  it("returns the order with per-line eligibility and a session for the canonical number", async () => {
    const { service, guest } = setup();
    const { view, sessionToken } = await service.lookup({ ...ANNA, ip: IP });
    expect(view.orderNumber).toBe("PL-10001");
    expect(view.deliveredAt).toBe("2026-11-02T10:00:00.000Z");
    expect(view.lines[0]).toEqual({
      lineRef: "L1",
      name: "Buty trekkingowe Tatra, rozm. 42",
      quantity: 1,
      remainingQuantity: 1,
      unitPriceText: "349,99 zł",
      eligible: true,
    });
    expect(view).not.toHaveProperty("trackingUrl");
    expect(await guest.verify(sessionToken)).toEqual({ orderNumber: "PL-10001" });
  });

  it("marks lines ineligible with their reason", async () => {
    const { service } = setup({ claimed: { "PL-10001": { L2: 1 } } });
    const { view } = await service.lookup({ ...ANNA, ip: IP });
    expect(view.lines[1]).toMatchObject({ lineRef: "L2", remainingQuantity: 0, eligible: false, ineligibleReason: "already_claimed" });
    const jan = await setup().service.lookup({ orderNumber: "PL-10002", email: "jan.nowak@example.pl", ip: IP });
    expect(jan.view.lines[1]).toMatchObject({ eligible: false, ineligibleReason: "not_returnable" });
  });

  it("gives the same neutral 404 for a wrong order and a wrong e-mail", async () => {
    const { service } = setup();
    const wrongOrder = await failure(service.lookup({ orderNumber: "PL-99999", email: ANNA.email, ip: IP }));
    const wrongEmail = await failure(service.lookup({ orderNumber: ANNA.orderNumber, email: "x@example.pl", ip: IP }));
    for (const error of [wrongOrder, wrongEmail]) {
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe(LOOKUP_NOT_FOUND_MESSAGE);
    }
    expect(wrongOrder.message).toBe(wrongEmail.message);
  });

  it("returns 429 on the eleventh lookup within a minute from one IP", async () => {
    const { service } = setup();
    for (let i = 0; i < 10; i += 1) await service.lookup({ ...ANNA, ip: IP });
    expect(await failure(service.lookup({ ...ANNA, ip: IP }))).toBeInstanceOf(TooManyRequestsError);
    // Another IP has its own budget.
    await expect(service.lookup({ ...ANNA, ip: "203.0.113.8" })).resolves.toBeDefined();
  });

  it("shares the failed-attempt budget between the three spellings of an order number", async () => {
    const { service } = setup();
    const spellings = ["pl-10001", "PL-10001 ", " Pl - 10001"];
    for (let i = 0; i < 5; i += 1) {
      const error = await failure(service.lookup({ orderNumber: spellings[i % 3] as string, email: "no@example.pl", ip: IP }));
      expect(error).toBeInstanceOf(NotFoundError);
    }
    // Sixth attempt: blocked, even with the right e-mail.
    expect(await failure(service.lookup({ ...ANNA, ip: IP }))).toBeInstanceOf(TooManyRequestsError);
    // A different IP (a stranger cannot lock out the real customer elsewhere) still works.
    await expect(service.lookup({ ...ANNA, ip: "203.0.113.9" })).resolves.toBeDefined();
  });

  it("answers 503 when the port is unavailable and consumes no budget", async () => {
    const down = setup({ port: unavailablePort() });
    for (let i = 0; i < 12; i += 1) {
      const error = await failure(down.service.lookup({ ...ANNA, ip: IP }));
      expect(error.status).toBe(503);
      expect(error.code).toBe("service_unavailable");
    }

    // Same limiter, port recovers: ten unavailable lookups then a normal one is not 429.
    let healthy = false;
    const flaky: OrderLookup = {
      lookup: (orderNumber, email) => (healthy ? createFakeOrderLookup({ clock: () => NOW }).lookup(orderNumber, email) : unavailablePort().lookup(orderNumber, email)),
      getByNumber: unavailablePort().getByNumber,
    };
    const { service } = setup({ port: flaky });
    for (let i = 0; i < 10; i += 1) await failure(service.lookup({ ...ANNA, ip: IP }));
    healthy = true;
    await expect(service.lookup({ ...ANNA, ip: IP })).resolves.toBeDefined();
  });

  it("reserves the budget before the port answers: 8 parallel wrong-e-mail lookups reach the port at most 5 times", async () => {
    const inner = createFakeOrderLookup({ clock: () => NOW });
    let reached = 0;
    const slow: OrderLookup = {
      lookup: async (orderNumber, email) => {
        reached += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return inner.lookup(orderNumber, email);
      },
      getByNumber: inner.getByNumber,
    };
    const { service } = setup({ port: slow });
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => service.lookup({ orderNumber: ANNA.orderNumber, email: "no@example.pl", ip: IP })),
    );
    expect(reached).toBe(5);
    const reasons = results.map((r) => (r.status === "rejected" ? (r.reason as AppError) : null));
    expect(reasons.filter((e) => e instanceof NotFoundError)).toHaveLength(5);
    expect(reasons.filter((e) => e instanceof TooManyRequestsError)).toHaveLength(3);
  });

  it("reserves the per-IP lookup budget before the port answers (12 parallel lookups of distinct orders: 10 reach the port, 2 are 429)", async () => {
    const inner = createFakeOrderLookup({ clock: () => NOW });
    const slow: OrderLookup = {
      lookup: async (orderNumber, email) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return inner.lookup(orderNumber, email);
      },
      getByNumber: inner.getByNumber,
    };
    const { service } = setup({ port: slow });
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) => service.lookup({ orderNumber: `PL-9${i}`, email: ANNA.email, ip: IP })),
    );
    expect(results.filter((r) => r.status === "rejected" && r.reason instanceof NotFoundError)).toHaveLength(10);
    expect(results.filter((r) => r.status === "rejected" && r.reason instanceof TooManyRequestsError)).toHaveLength(2);
  });

  it("gives tracking info and no session for an undelivered order", async () => {
    const { service } = setup();
    const outcome = await service.lookup({ orderNumber: "PL-10004", email: "piotr.zielinski@example.pl", ip: IP });
    expect(outcome.sessionToken).toBeNull();
    expect(outcome.view).toEqual({
      orderNumber: "PL-10004",
      deliveredAt: null,
      lines: [],
      trackingUrl: "https://tracking.example.pl/przesylka/PL10004",
    });
  });

  it("issues the session for the canonical number whatever the customer typed (S8)", async () => {
    const { service, guest } = setup();
    const outcome = await service.lookup({ orderNumber: "  pl-10001 ", email: ANNA.email.toUpperCase(), ip: IP });
    expect(outcome.view.orderNumber).toBe("PL-10001");
    expect(await guest.verify(outcome.sessionToken)).toEqual({ orderNumber: "PL-10001" });
  });
});

describe("ReturnLookupService.describeOrder", () => {
  it("returns the lookup view for the session order without issuing anything or consuming budget", async () => {
    const { service } = setup({ claimed: { "PL-10001": { L2: 1 } } });
    const view = await service.describeOrder("PL-10001");
    expect(view.orderNumber).toBe("PL-10001");
    expect(view.lines[0]).toMatchObject({ lineRef: "L1", eligible: true, remainingQuantity: 1 });
    expect(view.lines[1]).toMatchObject({ lineRef: "L2", eligible: false, ineligibleReason: "already_claimed" });
    for (let i = 0; i < 40; i += 1) await service.describeOrder("PL-10001");
  });

  it("returns no lines for an undelivered order", async () => {
    const view = await setup().service.describeOrder("PL-10004");
    expect(view.deliveredAt).toBeNull();
    expect(view.lines).toEqual([]);
  });

  it("maps unavailable to 503 and an unknown order to 404", async () => {
    expect((await failure(setup({ port: unavailablePort() }).service.describeOrder("PL-10001"))).status).toBe(503);
    expect((await failure(setup().service.describeOrder("PL-99999"))).status).toBe(404);
  });
});

describe("ReturnLookupService.quote", () => {
  const base = { sessionOrderNumber: "PL-10001", returnMethod: "courier", resolution: "refund" } as const;

  it("quotes eligible lines with the shipping fee", async () => {
    const { service } = setup();
    const quote = await service.quote({ ...base, items: [{ lineRef: "L1", quantity: 1 }] });
    expect(quote).toMatchObject({ amountMinor: 34999 - 1000, feeMinor: 1000, currency: "PLN" });
    expect(quote.amountText).toBe("339,99 zł");
  });

  it("returns null amounts for an exchange", async () => {
    const { service } = setup();
    const quote = await service.quote({ ...base, resolution: "exchange", items: [{ lineRef: "L1", quantity: 1 }] });
    expect(quote).toMatchObject({ amountMinor: null, feeMinor: null, amountText: null, feeText: null });
  });

  it("rejects bad lines with fieldErrors keyed items.<lineRef>", async () => {
    const { service } = setup({ claimed: { "PL-10001": { L2: 1 } } });
    const error = await failure(
      service.quote({
        ...base,
        items: [
          { lineRef: "L1", quantity: 2 },
          { lineRef: "L2", quantity: 1 },
          { lineRef: "ZZ", quantity: 1 },
        ],
      }),
    );
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.status).toBe(400);
    expect(error.fieldErrors).toEqual({
      "items.L1": "already_claimed",
      "items.L2": "already_claimed",
      "items.ZZ": "not_returnable",
    });
  });

  it("maps unavailable to 503 and an unknown order to 404", async () => {
    expect((await failure(setup({ port: unavailablePort() }).service.quote({ ...base, items: [{ lineRef: "L1", quantity: 1 }] }))).status).toBe(503);
    const missing = setup().service.quote({ ...base, sessionOrderNumber: "PL-00000", items: [{ lineRef: "L1", quantity: 1 }] });
    expect(await failure(missing)).toBeInstanceOf(NotFoundError);
  });

  it("does not spend session budget on unavailable answers, yet the 31st normal call is 429", async () => {
    let healthy = false;
    const inner = createFakeOrderLookup({ clock: () => NOW });
    const flaky: OrderLookup = {
      lookup: inner.lookup,
      getByNumber: (orderNumber) => (healthy ? inner.getByNumber(orderNumber) : unavailablePort().getByNumber(orderNumber)),
    };
    const { service } = setup({ port: flaky });
    for (let i = 0; i < 40; i += 1) {
      expect((await failure(service.quote({ ...base, items: [{ lineRef: "L1", quantity: 1 }] }))).status).toBe(503);
    }
    healthy = true;
    for (let i = 0; i < 30; i += 1) await service.quote({ ...base, items: [{ lineRef: "L1", quantity: 1 }] });
    expect(await failure(service.quote({ ...base, items: [{ lineRef: "L1", quantity: 1 }] }))).toBeInstanceOf(TooManyRequestsError);
  });

  it("limits parallel quotes to 30 per minute even while the port is slow", async () => {
    const inner = createFakeOrderLookup({ clock: () => NOW });
    const slow: OrderLookup = {
      lookup: inner.lookup,
      getByNumber: async (orderNumber) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return inner.getByNumber(orderNumber);
      },
    };
    const { service } = setup({ port: slow });
    const results = await Promise.allSettled(
      Array.from({ length: 35 }, () => service.quote({ ...base, items: [{ lineRef: "L1", quantity: 1 }] })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(30);
  });

  it("limits quotes to 30 per minute per order", async () => {
    const { service } = setup();
    for (let i = 0; i < 30; i += 1) await service.quote({ ...base, items: [{ lineRef: "L1", quantity: 1 }] });
    expect(await failure(service.quote({ ...base, items: [{ lineRef: "L1", quantity: 1 }] }))).toBeInstanceOf(TooManyRequestsError);
  });
});

describe("guest session guard", () => {
  it("answers 401 without a session, with a garbage token and with a token signed elsewhere", async () => {
    const { guest } = setup();
    const other = new GuestSessionService({ secret: "y".repeat(40), ttlSeconds: 7200, clock: () => NOW });
    for (const token of [null, undefined, "", "garbage", await other.issue("PL-10001")]) {
      const error = await failure(requireGuestSession(guest, token));
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.status).toBe(401);
      expect(error.code).toBe("unauthorized");
    }
    await expect(requireGuestSession(guest, await guest.issue("PL-10001"))).resolves.toEqual({ orderNumber: "PL-10001" });
  });

  it("clears the cookie for DELETE /api/returns/session (route returns 200 with this header; no cookie needed)", () => {
    const cleared = serializeClearedCookie("easyrms_guest", { secure: false });
    expect(cleared).toContain("Max-Age=0");
    expect(readCookie(cleared.split(";")[0], "easyrms_guest")).toBeNull();
  });
});

describe("ReturnService customer reads", () => {
  const rows = [
    makeRequest(),
    makeRequest({ id: 2, rma: "RMA-2026-00002", orderNumber: "PL-10002" }),
    makeRequest({ id: 3, rma: "RMA-2026-00003" }),
  ];

  it("lists only the session order's requests", async () => {
    const { returns } = setup({ rows });
    const list = await returns.listForOrder("PL-10001");
    expect(list.map((item) => item.rma)).toEqual(["RMA-2026-00001", "RMA-2026-00003"]);
  });

  it("returns an own request by RMA", async () => {
    const { returns } = setup({ rows });
    expect((await returns.getByRma("PL-10001", "RMA-2026-00001")).request.rma).toBe("RMA-2026-00001");
  });

  it("answers 404 for another order's RMA, identical to an unknown RMA", async () => {
    const { returns } = setup({ rows });
    const foreign = await failure(returns.getByRma("PL-10001", "RMA-2026-00002"));
    const unknown = await failure(returns.getByRma("PL-10001", "RMA-2026-99999"));
    expect(foreign).toBeInstanceOf(NotFoundError);
    expect(foreign.message).toBe(unknown.message);
    expect(await returns.listForOrder("PL-10003")).toEqual([]);
  });
});

describe("customer request schemas", () => {
  it("validates the lookup body", () => {
    expect(returnLookupSchema.safeParse({ orderNumber: " PL-1 ", email: "a@b.pl" }).data).toEqual({ orderNumber: "PL-1", email: "a@b.pl" });
    expect(returnLookupSchema.safeParse({ orderNumber: "", email: "a@b.pl" }).success).toBe(false);
    expect(returnLookupSchema.safeParse({ orderNumber: "PL-1", email: "nope" }).success).toBe(false);
  });

  it("validates the quote body", () => {
    const ok = { items: [{ lineRef: "L1", quantity: 1 }], returnMethod: "store", resolution: "refund" };
    expect(returnQuoteSchema.safeParse(ok).success).toBe(true);
    expect(returnQuoteSchema.safeParse({ ...ok, items: [] }).success).toBe(false);
    expect(returnQuoteSchema.safeParse({ ...ok, items: Array.from({ length: 21 }, (_, i) => ({ lineRef: `L${i}`, quantity: 1 })) }).success).toBe(false);
    expect(returnQuoteSchema.safeParse({ ...ok, items: [{ lineRef: "L1", quantity: 1 }, { lineRef: "L1", quantity: 2 }] }).success).toBe(false);
    for (const quantity of [0, -1, 1.5, "1"]) {
      expect(returnQuoteSchema.safeParse({ ...ok, items: [{ lineRef: "L1", quantity }] }).success).toBe(false);
    }
    expect(returnQuoteSchema.safeParse({ ...ok, returnMethod: "drone" }).success).toBe(false);
    expect(returnQuoteSchema.safeParse({ ...ok, resolution: "gift" }).success).toBe(false);
  });
});
