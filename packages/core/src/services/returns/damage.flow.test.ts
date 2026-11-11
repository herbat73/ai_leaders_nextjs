import { describe, expect, it, vi } from "vitest";

import { createFakeOrderLookup } from "../../adapters/orders/fake-order-lookup";
import { money } from "../../domain/money";
import { AppError, ConflictError, ValidationError } from "../../errors";
import { RateLimiter } from "../../security/rate-limiter";
import type { DamageSubmitBody } from "../../validators/returns/damage-submit.schema";
import type { MailMessage } from "../mail/mail.port";
import { recommend } from "./recommendation";
import { BRIEF_RULES } from "../../rules";
import { ReturnLookupService } from "./return-lookup.service";
import { ReturnService } from "./return.service";
import type { NewReturnRequest, ReturnRepository, ReturnRequest, ReturnStatus } from "./types";

const NOW = new Date("2026-11-05T10:00:00Z");
const KEY_A = "11111111-1111-4111-8111-111111111111";
const AGENT = { id: 7, permissions: [] as never[] };

interface FakeRepo extends ReturnRepository {
  rows: ReturnRequest[];
  inputs: NewReturnRequest[];
  transitions: unknown[][];
}

function makeRepo(seed: ReturnRequest[] = []): FakeRepo {
  const itemsOf = new Map<number, NewReturnRequest["items"]>();
  const repo: FakeRepo = {
    rows: [...seed],
    inputs: [],
    transitions: [],
    list: async () => repo.rows,
    listInbox: async () => ({ rows: repo.rows, total: repo.rows.length, page: 1, pageCount: 1 }),
    findDetail: async () => null,
    findStatus: async (id) => repo.rows.find((row) => row.id === id)?.status ?? null,
    findRequest: async (id) => repo.rows.find((row) => row.id === id) ?? null,
    listByOrder: async () => [],
    findByRma: async () => null,
    findByIdempotencyKey: async () => null,
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
      const id = repo.rows.length + 1;
      const row: ReturnRequest = {
        id,
        rma: `RMA-2026-${String(id).padStart(5, "0")}`,
        kind: input.kind ?? "return",
        orderNumber: input.orderNumber,
        customerEmail: input.customerEmail,
        reason: null,
        status: "submitted",
        hasDecisionNote: false,
        resolution: input.resolution,
        resolutionAmount: input.resolutionAmount,
        createdAt: NOW,
        updatedAt: NOW,
      };
      repo.rows.push(row);
      itemsOf.set(id, input.items);
      return row;
    },
    withOrderLock: async (_order, fn) => fn(repo),
    transition: async (id, from, to, _note, _agent, defectConfirmed) => {
      repo.transitions.push([id, from, to, defectConfirmed]);
      const row = repo.rows.find((candidate) => candidate.id === id);
      if (!row) return { result: "not_found" };
      row.status = to;
      if (defectConfirmed !== undefined) row.defectConfirmed = defectConfirmed;
      return { result: "moved", request: row };
    },
  };
  return repo;
}

function setup(seed: ReturnRequest[] = []) {
  const repo = makeRepo(seed);
  const sent: MailMessage[] = [];
  const orderLookup = createFakeOrderLookup({ clock: () => NOW });
  const rateLimiter = new RateLimiter({ clock: () => NOW });
  const service = new ReturnService({
    returnRepository: repo,
    clock: () => NOW,
    mailPort: { send: (message) => void sent.push(message) },
    logger: { error: vi.fn() },
    orderLookup,
    rateLimiter,
    eligibilityConfig: { windowDays: 30 },
    quoteConfig: { shippingFee: money(1000) },
    approvalConfig: { refundApprovalLimit: money(200000) },
    transportConfig: { windowDays: 14 },
  });
  const lookup = new ReturnLookupService({
    returnRepository: repo,
    orderLookup,
    rateLimiter,
    guestSessionService: undefined as never,
    clock: () => NOW,
    eligibilityConfig: { windowDays: 30 },
    quoteConfig: { shippingFee: money(1000) },
    transportConfig: { windowDays: 14 },
  });
  return { repo, service, lookup, sent };
}

function damage(overrides: Partial<DamageSubmitBody> = {}): DamageSubmitBody {
  return {
    kind: "transport",
    items: [{ lineRef: "L1", quantity: 1 }],
    defectDescription: "The box was crushed and the sole is cracked.",
    defectDiscoveredOn: "2026-11-04",
    resolution: "replacement",
    acknowledged: true,
    idempotencyKey: KEY_A,
    ...overrides,
  };
}

function fieldsOf(error: AppError): Record<string, string> {
  return (error as ValidationError).fields;
}

async function failure(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

describe("ReturnService.submit with kind transport", () => {
  it("stores the report with the description, the courier note and no return method", async () => {
    const { repo, service, sent } = setup();
    const result = await service.submit("PL-10001", damage({ courierNote: true }));

    expect(result).toMatchObject({ created: true, status: "submitted", resolution: "replacement", resolutionAmount: null });
    expect(repo.inputs[0]).toMatchObject({
      kind: "transport",
      returnMethod: null,
      courierNote: true,
      defectDescription: "The box was crushed and the sole is cracked.",
      defectDiscoveredOn: "2026-11-04",
      items: [{ lineRef: "L1", reasonCode: "damaged_in_transit" }],
    });
    expect(sent).toEqual([
      { template: "return_submitted", to: "anna.kowalska@example.pl", data: { rma: "RMA-2026-00001", resolution: "replacement", kind: "transport" } },
    ]);
  });

  it("leaves the courier note out when the customer did not answer", async () => {
    const { repo, service } = setup();
    await service.submit("PL-10001", damage());
    expect(repo.inputs[0]).not.toHaveProperty("courierNote");
  });

  it("refunds the goods value with no shipping deduction", async () => {
    const { service } = setup();
    const result = await service.submit("PL-10001", damage({ resolution: "refund" }));
    expect(result.resolutionAmount).toMatchObject({ amountMinor: 34999 });
  });

  it("refuses a report outside the 14-day window", async () => {
    const { service } = setup();
    const error = await failure(service.submit("PL-10003", damage({ defectDiscoveredOn: "2026-11-01" })));
    expect(error).toBeInstanceOf(ValidationError);
    expect(fieldsOf(error)).toEqual({ "items.L1": "outside_window" });
  });

  it("accepts a line a return would refuse (not returnable)", async () => {
    const { service } = setup();
    expect((await service.submit("PL-10002", damage({ items: [{ lineRef: "L2", quantity: 1 }] }))).created).toBe(true);
  });

  it("refuses a noticed-on date before the delivery", async () => {
    const { service } = setup();
    const error = await failure(service.submit("PL-10001", damage({ defectDiscoveredOn: "2026-10-01" })));
    expect(fieldsOf(error)).toEqual({ defectDiscoveredOn: "before_delivery" });
  });

  it("refuses a unit already held by an open request (shared pool)", async () => {
    const { service } = setup();
    await service.submit("PL-10001", damage());
    const error = await failure(service.submit("PL-10001", damage({ idempotencyKey: "22222222-2222-4222-8222-222222222222" })));
    expect(fieldsOf(error)).toEqual({ "items.L1": "already_claimed" });
  });

  it("refuses an undelivered order", async () => {
    const { service } = setup();
    const error = await failure(service.submit("PL-10004", damage()));
    expect(fieldsOf(error)).toEqual({ "items.L1": "not_returnable" });
  });

  it("refuses a quantity above the remaining quantity", async () => {
    const { service } = setup();
    const error = await failure(service.submit("PL-10001", damage({ items: [{ lineRef: "L1", quantity: 2 }] })));
    expect(error).toBeInstanceOf(ValidationError);
  });
});

describe("ReturnService.submit with kind missing", () => {
  it("stores missing_element by default, wrong_item when chosen, and allows resend_part", async () => {
    const { repo, service } = setup();
    const missing = damage({ kind: "missing", resolution: "resend_part", defectDescription: "The charger was not in the box." });
    expect((await service.submit("PL-10001", missing)).resolution).toBe("resend_part");
    expect(repo.inputs[0]).toMatchObject({ kind: "missing", returnMethod: null, items: [{ reasonCode: "missing_element" }] });

    await service.submit(
      "PL-10005",
      damage({ ...missing, items: [{ lineRef: "L1", quantity: 1, reasonCode: "wrong_item" }], idempotencyKey: "33333333-3333-4333-8333-333333333333" }),
    );
    expect(repo.inputs[1]?.items[0]?.reasonCode).toBe("wrong_item");
  });

  it("does not store the courier note", async () => {
    const { repo, service } = setup();
    await service.submit("PL-10001", damage({ kind: "missing" }));
    expect(repo.inputs[0]).not.toHaveProperty("courierNote");
  });
});

describe("ReturnLookupService for the damage kinds", () => {
  it("quotes a refund and gives no amount for a replacement or resend", async () => {
    const { lookup } = setup();
    const base = { kind: "transport" as const, sessionOrderNumber: "PL-10001", items: [{ lineRef: "L1", quantity: 1 }] };
    expect(await lookup.quote({ ...base, resolution: "refund" })).toMatchObject({ amountMinor: 34999, feeMinor: 0 });
    expect(await lookup.quote({ ...base, resolution: "replacement" })).toMatchObject({ amountMinor: null });
    expect(await lookup.quote({ ...base, kind: "missing", resolution: "resend_part" })).toMatchObject({ amountMinor: null });
  });

  it("applies the transport window when describing the order", async () => {
    const { lookup } = setup();
    expect((await lookup.describeOrder("PL-10001", "transport")).lines[0]?.eligible).toBe(true);
    expect((await lookup.describeOrder("PL-10003", "missing")).lines[0]).toMatchObject({ eligible: false, ineligibleReason: "outside_window" });
    expect((await lookup.describeOrder("PL-10002", "transport")).lines.map((line) => line.eligible)).toEqual([true, true]);
  });
});

describe("ReturnService.transition for the damage kinds", () => {
  const row = (overrides: Partial<ReturnRequest>): ReturnRequest => ({
    id: 1,
    rma: "RMA-2026-00001",
    kind: "transport",
    orderNumber: "PL-10001",
    customerEmail: "anna.kowalska@example.pl",
    reason: null,
    status: "submitted",
    hasDecisionNote: false,
    resolution: "replacement",
    createdAt: new Date("2026-11-04T10:00:00Z"),
    updatedAt: NOW,
    ...overrides,
  });

  it("approves, then resolves, with no return leg", async () => {
    const { service } = setup([row({})]);
    const approved = await service.transition(1, "approved", "Wyślemy nowy produkt.", AGENT);
    expect(approved.allowedTransitions).toEqual(["resolved"]);
    expect((await service.transition(1, "resolved", undefined, AGENT)).status).toBe("resolved");
  });

  it.each([
    ["submitted", "resolved"],
    ["approved", "in_transit"],
    ["submitted", "in_transit"],
  ] as const)("refuses %s to %s with a conflict", async (from, to) => {
    const { service } = setup([row({ status: from })]);
    expect(await failure(service.transition(1, to, undefined, AGENT))).toBeInstanceOf(ConflictError);
  });

  it("refuses a finding like it does for a return", async () => {
    const { service } = setup([row({ status: "approved" })]);
    const error = await failure(service.transition(1, "resolved", undefined, AGENT, true));
    expect(fieldsOf(error)).toHaveProperty("defectConfirmed");
  });

  it("lists the allowed moves and a due date like a return", async () => {
    const { service } = setup([row({})]);
    const [item] = await service.list();
    expect(item).toMatchObject({ allowedTransitions: ["approved", "rejected"], overdue: false });
    expect(item).not.toHaveProperty("escalated");
  });
});

describe("rules recommendations for the damage kinds", () => {
  const base = { id: 1, rma: "R", orderNumber: "O", customerEmail: "a@b.pl", reason: null, status: "submitted" as const, hasDecisionNote: false, createdAt: NOW, updatedAt: NOW };

  it("flags transport damage as high priority even without an amount (R10a)", () => {
    const result = recommend({ kind: "transport", resolutionAmount: null }, BRIEF_RULES);
    expect(result).toMatchObject({ highPriority: true, recommended: "none", ruleIds: [] });
    expect(result.rules.map((rule) => rule.id)).toEqual(["R10a"]);
  });

  it("recommends approval of a small transport refund and flags the priority (R09 and R10a)", () => {
    const result = recommend({ kind: "transport", resolutionAmount: money(5000) }, BRIEF_RULES);
    expect(result).toMatchObject({ highPriority: true, recommended: "approve", keepItem: true });
  });

  it("does not flag a missing item or recommend one without an amount", () => {
    expect(recommend({ kind: "missing", resolutionAmount: null }, BRIEF_RULES)).toMatchObject({ highPriority: false, recommended: "none" });
  });

  it("shows the badge on the inbox row only while the flag is on", async () => {
    const repo = makeRepo([{ ...base, kind: "transport", resolution: "replacement", resolutionAmount: null }]);
    const service = new ReturnService({
      returnRepository: repo,
      clock: () => NOW,
      mailPort: { send: () => undefined },
      logger: { error: vi.fn() },
      orderLookup: createFakeOrderLookup({ clock: () => NOW }),
      rateLimiter: new RateLimiter({ clock: () => NOW }),
      eligibilityConfig: { windowDays: 30 },
      quoteConfig: { shippingFee: money(1000) },
      approvalConfig: { refundApprovalLimit: money(200000) },
      recommendationConfig: { enabled: true, rules: BRIEF_RULES },
    });
    const view = await service.listInbox({ page: 1 });
    expect(view.rows[0]).toMatchObject({ highPriority: true, recommendApprove: false });
  });
});
