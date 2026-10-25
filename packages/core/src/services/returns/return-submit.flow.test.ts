import { describe, expect, it, vi } from "vitest";

import { createFakeOrderLookup } from "../../adapters/orders/fake-order-lookup";
import { money } from "../../domain/money";
import { AppError, ConflictError, ValidationError } from "../../errors";
import { RateLimiter } from "../../security/rate-limiter";
import { parseWith } from "../../http/parse";
import { returnSubmitSchema, type ReturnSubmitBody } from "../../validators/returns/return-submit.schema";
import type { MailMessage } from "../mail/mail.port";
import type { OrderLookup, OrderLookupResult } from "../orders/order-lookup.port";
import { ReturnService } from "./return.service";
import type { NewReturnRequest, ReturnRepository, ReturnRequest } from "./types";

const NOW = new Date("2026-11-05T10:00:00Z");
const KEY_A = "11111111-1111-4111-8111-111111111111";
const KEY_B = "22222222-2222-4222-8222-222222222222";
const ANNA_EMAIL = "anna.kowalska@example.pl";

interface FakeRepo extends ReturnRepository {
  rows: ReturnRequest[];
  inputs: NewReturnRequest[];
  /** Runs when a lock is requested, before it is taken: a request that slips in after the service's pre-lock check. */
  beforeLock?: () => Promise<void>;
  /** Every key `withOrderLock` was asked to lock on. */
  lockKeys: string[];
  /** Makes `findByIdempotencyKey` blind and the insert raise the unique-violation `ConflictError`. */
  uniqueViolationOnInsert?: boolean;
}

/** In-memory repository port; `withOrderLock` is a per-order mutex (a promise chain), like the advisory lock. */
function makeRepo(): FakeRepo {
  const tails = new Map<string, Promise<unknown>>();
  const unsupported = (): never => {
    throw new Error("not implemented in this fake");
  };
  const repo: FakeRepo = {
    rows: [],
    inputs: [],
    lockKeys: [],
    list: async () => repo.rows,
    findDetail: async () => null,
    findStatus: async (id) => repo.rows.find((row) => row.id === id)?.status ?? null,
    findRequest: async (id) => repo.rows.find((row) => row.id === id) ?? null,
    transition: unsupported,
    listByOrder: async (orderNumber) => repo.rows.filter((row) => row.orderNumber === orderNumber),
    findByRma: async () => null,
    findByIdempotencyKey: async (key) =>
      repo.uniqueViolationOnInsert ? null : (repo.rows.find((row) => keys.get(row.id) === key) ?? null),
    claimedQuantities: async (orderNumber) => {
      const held: Record<string, number> = {};
      for (const row of repo.rows) {
        if (row.orderNumber !== orderNumber || row.status === "cancelled" || row.status === "rejected") continue;
        for (const item of itemsOf.get(row.id) ?? []) held[item.lineRef] = (held[item.lineRef] ?? 0) + item.quantity;
      }
      return held;
    },
    createWithItems: async (input) => {
      repo.inputs.push(input);
      // Yield once so an unlocked caller would interleave with a concurrent one.
      await Promise.resolve();
      if (repo.uniqueViolationOnInsert || [...keys.values()].includes(input.idempotencyKey)) {
        throw new ConflictError("Idempotency key already used");
      }
      const id = repo.rows.length + 1;
      const row: ReturnRequest = {
        id,
        rma: `RMA-2026-${String(id).padStart(5, "0")}`,
        kind: "return",
        orderNumber: input.orderNumber,
        customerEmail: input.customerEmail,
        reason: null,
        status: "submitted",
        hasDecisionNote: false,
        resolution: input.resolution,
        resolutionAmount: input.resolutionAmount,
        returnMethod: input.returnMethod,
        exchangeNote: input.exchangeNote ?? null,
        createdAt: NOW,
        updatedAt: NOW,
      };
      repo.rows.push(row);
      keys.set(id, input.idempotencyKey);
      itemsOf.set(id, input.items);
      return row;
    },
    withOrderLock: async (orderNumber, fn) => {
      repo.lockKeys.push(orderNumber);
      await repo.beforeLock?.();
      const previous = tails.get(orderNumber) ?? Promise.resolve();
      const run = previous.then(() => fn(repo));
      tails.set(orderNumber, run.catch(() => undefined));
      return run;
    },
  };
  const keys = new Map<number, string>();
  const itemsOf = new Map<number, NewReturnRequest["items"]>();
  return repo;
}

function setup(options: { port?: OrderLookup; mailFails?: boolean } = {}) {
  const repo = makeRepo();
  const sent: MailMessage[] = [];
  const logger = { error: vi.fn() };
  const service = new ReturnService({
    returnRepository: repo,
    clock: () => NOW,
    mailPort: {
      send: (message) => {
        if (options.mailFails) throw new Error("smtp down");
        sent.push(message);
      },
    },
    logger,
    orderLookup: options.port ?? createFakeOrderLookup({ clock: () => NOW }),
    rateLimiter: new RateLimiter({ clock: () => NOW }),
    eligibilityConfig: { windowDays: 30 },
    quoteConfig: { shippingFee: money(1000) },
    approvalConfig: { refundApprovalLimit: money(200000) },
  });
  return { repo, service, sent, logger };
}

function body(overrides: Partial<ReturnSubmitBody> = {}): ReturnSubmitBody {
  return {
    items: [{ lineRef: "L1", quantity: 1, reasonCode: "size" }],
    resolution: "refund",
    returnMethod: "courier",
    acknowledged: true,
    idempotencyKey: KEY_A,
    ...overrides,
  };
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

describe("ReturnService.submit", () => {
  it("creates a request with a server-priced amount, an order snapshot and the order's e-mail", async () => {
    const { repo, service, sent } = setup();
    const result = await service.submit("PL-10001", body());
    expect(result).toEqual({
      created: true,
      rma: "RMA-2026-00001",
      status: "submitted",
      resolution: "refund",
      resolutionAmount: { amountMinor: 33999, currency: "PLN", text: "339,99 zł" },
    });
    expect(repo.inputs[0]).toMatchObject({
      orderNumber: "PL-10001",
      customerEmail: ANNA_EMAIL,
      items: [{ lineRef: "L1", sku: "BUT-TRK-42", name: "Buty trekkingowe Tatra, rozm. 42", unitPrice: money(34999) }],
    });
    expect(sent).toEqual([{ template: "return_submitted", to: ANNA_EMAIL, data: { rma: "RMA-2026-00001", resolution: "refund", kind: "return" } }]);
  });

  it("has no amount for an exchange and keeps the note", async () => {
    const { repo, service } = setup();
    const result = await service.submit("PL-10001", body({ resolution: "exchange", exchangeNote: "Rozmiar 43" }));
    expect(result.resolutionAmount).toBeNull();
    expect(repo.inputs[0]).toMatchObject({ resolutionAmount: null, exchangeNote: "Rozmiar 43" });
  });

  it("ignores a client-supplied amount and e-mail (stripped by the schema)", async () => {
    const { repo, service } = setup();
    const parsed = returnSubmitSchema.parse({
      ...body(),
      resolutionAmount: { amountMinor: 1 },
      amount: 1,
      customerEmail: "attacker@example.com",
      orderNumber: "PL-10002",
    });
    await service.submit("PL-10001", parsed);
    expect(repo.inputs[0]).toMatchObject({ orderNumber: "PL-10001", customerEmail: ANNA_EMAIL });
    expect(repo.inputs[0]?.resolutionAmount).toEqual(money(33999));
  });

  it("returns the original for a repeated key with 200 semantics and sends no second mail", async () => {
    const { repo, service, sent } = setup();
    const first = await service.submit("PL-10001", body());
    const again = await service.submit("PL-10001", body());
    expect(again).toEqual({ ...first, created: false });
    expect(repo.rows).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });

  it("returns the original unchanged for the same key with a different payload", async () => {
    const { repo, service } = setup();
    const first = await service.submit("PL-10001", body());
    const again = await service.submit(
      "PL-10001",
      body({ items: [{ lineRef: "L2", quantity: 1, reasonCode: "mistake" }], resolution: "store_credit" }),
    );
    expect(again).toEqual({ ...first, created: false });
    expect(repo.rows).toHaveLength(1);
  });

  it("answers 400 with field errors for a quantity above what remains (pre-lock check)", async () => {
    const { repo, service, sent } = setup();
    const error = await failure(service.submit("PL-10001", body({ items: [{ lineRef: "L1", quantity: 2, reasonCode: "size" }] })));
    expect(error).toMatchObject({ status: 400, code: "validation_error", fieldErrors: { "items.L1": "already_claimed" } });
    expect(repo.rows).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it("answers 400 for a non-returnable line, an unknown line and an expired window", async () => {
    const { service } = setup();
    const notReturnable = await failure(
      service.submit("PL-10002", body({ items: [{ lineRef: "L2", quantity: 1, reasonCode: "other" }] })),
    );
    expect(notReturnable.fieldErrors).toEqual({ "items.L2": "not_returnable" });
    const unknown = await failure(service.submit("PL-10001", body({ items: [{ lineRef: "L9", quantity: 1, reasonCode: "other" }] })));
    expect(unknown.fieldErrors).toEqual({ "items.L9": "not_returnable" });
    const expired = await failure(service.submit("PL-10003", body()));
    expect(expired.fieldErrors).toEqual({ "items.L1": "outside_window" });
  });

  it("answers 409 when a concurrent request takes the quantity between the check and the lock", async () => {
    const { repo, service, sent } = setup();
    repo.beforeLock = async () => {
      repo.beforeLock = undefined;
      await service.submit("PL-10001", body({ idempotencyKey: KEY_B }));
    };
    const error = await failure(service.submit("PL-10001", body()));
    expect(error).toMatchObject({ status: 409, code: "conflict", fieldErrors: { "items.L1": "already_claimed" } });
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]?.rma).toBe("RMA-2026-00001");
    expect(sent).toHaveLength(1);
  });

  it("serialises two submits for one line: one 201 and one 409", async () => {
    const { repo, service } = setup();
    const results = await Promise.allSettled([
      service.submit("PL-10001", body({ idempotencyKey: KEY_A })),
      service.submit("PL-10001", body({ idempotencyKey: KEY_B })),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ status: 409, code: "conflict" });
    expect(repo.rows).toHaveLength(1);
  });

  it("locks, stores and compares on the canonical order number, never a case or space variant (S8)", async () => {
    const { repo, service } = setup();
    const results = await Promise.allSettled([
      service.submit("pl-10001", body({ idempotencyKey: KEY_A })),
      service.submit("  Pl-10001 ", body({ idempotencyKey: KEY_B })),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(repo.lockKeys).toEqual(["PL-10001", "PL-10001"]);
    expect(repo.inputs.map((input) => input.orderNumber)).toEqual(["PL-10001"]);
    expect(repo.rows).toHaveLength(1);
  });

  it("serialises the same key sent twice at once: 201 then 200", async () => {
    const { repo, service, sent } = setup();
    const [first, second] = await Promise.all([service.submit("PL-10001", body()), service.submit("PL-10001", body())]);
    expect([first.created, second.created]).toEqual([true, false]);
    expect(second.rma).toBe(first.rma);
    expect(repo.rows).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });

  it("answers 409 for a key already used by another order", async () => {
    const { repo, service, sent } = setup();
    await service.submit("PL-10001", body());
    const error = await failure(service.submit("PL-10005", body({ items: [{ lineRef: "L1", quantity: 1, reasonCode: "size" }] })));
    expect(error).toMatchObject({ status: 409, code: "conflict" });
    expect(repo.rows).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });

  it("surfaces the repository's unique-violation ConflictError as 409 and sends no mail", async () => {
    const { repo, service, sent } = setup();
    repo.uniqueViolationOnInsert = true;
    const error = await failure(service.submit("PL-10001", body()));
    expect(error).toMatchObject({ status: 409, code: "conflict" });
    expect(sent).toHaveLength(0);
  });

  it("answers 503 and inserts nothing when the order platform is unavailable", async () => {
    const port: OrderLookup = {
      lookup: async (): Promise<OrderLookupResult> => ({ status: "unavailable" }),
      getByNumber: async (): Promise<OrderLookupResult> => ({ status: "unavailable" }),
    };
    const { repo, service } = setup({ port });
    const error = await failure(service.submit("PL-10001", body()));
    expect(error).toMatchObject({ status: 503, code: "service_unavailable" });
    expect(repo.inputs).toHaveLength(0);
  });

  it("does not spend session budget on unavailable answers", async () => {
    let healthy = false;
    const unavailable: OrderLookupResult = { status: "unavailable" };
    const port: OrderLookup = {
      lookup: async (): Promise<OrderLookupResult> => unavailable,
      getByNumber: async (orderNumber): Promise<OrderLookupResult> =>
        healthy ? createFakeOrderLookup({ clock: () => NOW }).getByNumber(orderNumber) : unavailable,
    };
    const { service } = setup({ port });
    for (let i = 0; i < 35; i += 1) expect(await failure(service.submit("PL-10001", body()))).toMatchObject({ status: 503 });
    healthy = true;
    for (let i = 0; i < 30; i += 1) {
      await failure(service.submit("PL-10001", body({ items: [{ lineRef: "L9", quantity: 1, reasonCode: "other" }] })));
    }
    expect(await failure(service.submit("PL-10001", body()))).toMatchObject({ status: 429, code: "rate_limited" });
  });

  it("answers 404 for an unknown order", async () => {
    const { service } = setup();
    expect(await failure(service.submit("PL-99999", body()))).toMatchObject({ status: 404 });
  });

  it("answers 429 after 30 calls per minute, shared with quote", async () => {
    const { service } = setup();
    for (let i = 0; i < 30; i += 1) {
      await failure(service.submit("PL-10001", body({ items: [{ lineRef: "L9", quantity: 1, reasonCode: "other" }] })));
    }
    expect(await failure(service.submit("PL-10001", body()))).toMatchObject({ status: 429, code: "rate_limited" });
  });

  it("still succeeds when the mail port fails, logging only the masked recipient", async () => {
    const { repo, service, logger } = setup({ mailFails: true });
    const result = await service.submit("PL-10001", body());
    expect(result.created).toBe(true);
    expect(repo.rows).toHaveLength(1);
    expect(logger.error).toHaveBeenCalledWith("mail send failed", {
      template: "return_submitted",
      to: "a***@example.pl",
      error: "Error",
    });
  });

  it("lets a quantity released by a cancelled request be returned again (S7)", async () => {
    const { repo, service } = setup();
    await service.submit("PL-10001", body());
    const row = repo.rows[0];
    if (!row) throw new Error("expected a row");
    row.status = "cancelled";
    const again = await service.submit("PL-10001", body({ idempotencyKey: KEY_B }));
    expect(again).toMatchObject({ created: true, rma: "RMA-2026-00002" });
  });
});

describe("returnSubmitSchema", () => {
  const valid = { ...body() };

  it("accepts a valid body and trims strings", () => {
    const parsed = returnSubmitSchema.parse({ ...valid, items: [{ lineRef: " L1 ", quantity: 1, reasonCode: "size", comment: " ok " }] });
    expect(parsed.items[0]).toEqual({ lineRef: "L1", quantity: 1, reasonCode: "size", comment: "ok" });
  });

  it.each([
    ["no items", { items: [] }],
    ["21 items", { items: Array.from({ length: 21 }, (_, i) => ({ lineRef: `L${i}`, quantity: 1, reasonCode: "size" })) }],
    ["duplicate lineRef", { items: [valid.items[0], valid.items[0]] }],
    ["zero quantity", { items: [{ lineRef: "L1", quantity: 0, reasonCode: "size" }] }],
    ["fractional quantity", { items: [{ lineRef: "L1", quantity: 1.5, reasonCode: "size" }] }],
    ["unknown reason", { items: [{ lineRef: "L1", quantity: 1, reasonCode: "boring" }] }],
    ["long comment", { items: [{ lineRef: "L1", quantity: 1, reasonCode: "size", comment: "x".repeat(501) }] }],
    ["exchange without a note", { resolution: "exchange" }],
    ["long exchange note", { resolution: "exchange", exchangeNote: "x".repeat(201) }],
    ["not acknowledged", { acknowledged: false }],
    ["missing acknowledgement", { acknowledged: undefined }],
    ["non-UUID key", { idempotencyKey: "abc" }],
    ["unknown method", { returnMethod: "drone" }],
  ])("rejects %s", (_name, patch) => {
    expect(returnSubmitSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it("does not require an exchange note for other resolutions", () => {
    expect(returnSubmitSchema.safeParse({ ...valid, resolution: "store_credit" }).success).toBe(true);
  });

  it("rejects the legacy orderNumber/customerEmail/reason body with a validation error naming the missing fields", () => {
    const legacy = { orderNumber: "ORD-1", customerEmail: "a@example.com", reason: "Too small" };

    let thrown: unknown;
    try {
      parseWith(returnSubmitSchema, legacy);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ValidationError);
    const fieldErrors = (thrown as ValidationError).fieldErrors ?? {};
    expect(Object.keys(fieldErrors)).toEqual(expect.arrayContaining(["items", "resolution", "returnMethod", "acknowledged", "idempotencyKey"]));
    expect(fieldErrors).not.toHaveProperty("reason");
  });
});
