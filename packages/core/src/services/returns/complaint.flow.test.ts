import { describe, expect, it, vi } from "vitest";

import { createFakeOrderLookup } from "../../adapters/orders/fake-order-lookup";
import { money } from "../../domain/money";
import { AppError, ConflictError, ValidationError } from "../../errors";
import { RateLimiter } from "../../security/rate-limiter";
import type { ComplaintSubmitBody } from "../../validators/returns/complaint-submit.schema";
import type { MailMessage } from "../mail/mail.port";
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
  });
  const lookup = new ReturnLookupService({
    returnRepository: repo,
    orderLookup,
    rateLimiter,
    guestSessionService: undefined as never,
    clock: () => NOW,
    eligibilityConfig: { windowDays: 30 },
    quoteConfig: { shippingFee: money(1000) },
  });
  return { repo, service, lookup, sent };
}

function complaint(overrides: Partial<ComplaintSubmitBody> = {}): ComplaintSubmitBody {
  return {
    kind: "complaint",
    items: [{ lineRef: "L1", quantity: 1, serialNumber: "SN-1" }],
    defectDescription: "The sole came off after one week of normal use.",
    defectDiscoveredOn: "2026-11-04",
    resolution: "repair",
    returnMethod: "courier",
    acknowledged: true,
    idempotencyKey: KEY_A,
    ...overrides,
  };
}

function request(overrides: Partial<ReturnRequest> = {}): ReturnRequest {
  return {
    id: 1,
    rma: "RMA-2026-00001",
    kind: "complaint",
    orderNumber: "PL-10001",
    customerEmail: "anna.kowalska@example.pl",
    reason: null,
    status: "submitted",
    hasDecisionNote: false,
    resolution: "repair",
    createdAt: new Date("2026-11-01T10:00:00Z"),
    updatedAt: NOW,
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

describe("ReturnService.submit with kind complaint", () => {
  it("stores a complaint with the defect, the serial number and no amount for a repair", async () => {
    const { repo, service, sent } = setup();
    const result = await service.submit("PL-10001", complaint());

    expect(result).toMatchObject({ created: true, status: "submitted", resolution: "repair", resolutionAmount: null });
    expect(repo.inputs[0]).toMatchObject({
      kind: "complaint",
      defectDescription: "The sole came off after one week of normal use.",
      defectDiscoveredOn: "2026-11-04",
      resolution: "repair",
      resolutionAmount: null,
      items: [{ lineRef: "L1", reasonCode: "defective", serialNumber: "SN-1", name: "Buty trekkingowe Tatra, rozm. 42" }],
    });
    expect(sent).toEqual([
      { template: "return_submitted", to: "anna.kowalska@example.pl", data: { rma: "RMA-2026-00001", resolution: "repair", kind: "complaint" } },
    ]);
  });

  it("refunds the goods value with no shipping deduction", async () => {
    const { service } = setup();
    const result = await service.submit("PL-10001", complaint({ resolution: "refund", returnMethod: "courier" }));
    expect(result.resolutionAmount).toMatchObject({ amountMinor: 34999 });
  });

  it("accepts a product delivered 120 days ago, outside the return window but inside the warranty", async () => {
    const { service } = setup();
    const result = await service.submit("PL-10003", complaint({ defectDiscoveredOn: "2026-11-01" }));
    expect(result.created).toBe(true);
  });

  it("accepts a line a return would refuse (not returnable, R06)", async () => {
    const { service } = setup();
    const result = await service.submit("PL-10002", complaint({ items: [{ lineRef: "L2", quantity: 1 }] }));
    expect(result.created).toBe(true);
  });

  it("refuses a defect discovered before the delivery", async () => {
    const { service } = setup();
    const error = await failure(service.submit("PL-10001", complaint({ defectDiscoveredOn: "2026-10-01" })));
    expect(error).toBeInstanceOf(ValidationError);
    expect(fieldsOf(error)).toEqual({ defectDiscoveredOn: "before_delivery" });
  });

  it("refuses a unit already held by a return or complaint (shared pool)", async () => {
    const { service } = setup();
    await service.submit("PL-10001", complaint());
    const error = await failure(service.submit("PL-10001", complaint({ idempotencyKey: "22222222-2222-4222-8222-222222222222" })));
    expect(fieldsOf(error)).toEqual({ "items.L1": "already_claimed" });
  });

  it("refuses an undelivered order", async () => {
    const { service } = setup();
    const error = await failure(service.submit("PL-10004", complaint()));
    expect(fieldsOf(error)).toEqual({ "items.L1": "not_returnable" });
  });
});

describe("ReturnLookupService.quote for a complaint", () => {
  it("prices a refund and gives no amount for a replacement", async () => {
    const { lookup } = setup();
    const base = { kind: "complaint" as const, sessionOrderNumber: "PL-10001", items: [{ lineRef: "L1", quantity: 1 }], returnMethod: "courier" as const };
    expect(await lookup.quote({ ...base, resolution: "refund" })).toMatchObject({ amountMinor: 34999, feeMinor: 0 });
    expect(await lookup.quote({ ...base, resolution: "replacement" })).toMatchObject({ amountMinor: null });
  });

  it("accepts a non-returnable line", async () => {
    const { lookup } = setup();
    const quote = await lookup.quote({
      kind: "complaint",
      sessionOrderNumber: "PL-10002",
      items: [{ lineRef: "L2", quantity: 1 }],
      returnMethod: "store",
      resolution: "refund",
    });
    expect(quote.amountMinor).toBe(8900);
  });
});

describe("ReturnService.transition for a complaint", () => {
  const move = (service: ReturnService, status: ReturnStatus, finding?: boolean) =>
    service.transition(1, status, undefined, AGENT, finding);

  it("follows the complaint machine, including the repair path", async () => {
    const { service } = setup([request({ status: "received", defectConfirmed: null })]);
    const moved = await move(service, "in_service");
    expect(moved.status).toBe("in_service");
    expect(moved.allowedTransitions).toEqual(["resolved"]);
  });

  it("requires the finding with the move to received", async () => {
    const { service, repo } = setup([request({ status: "in_transit" })]);
    const error = await failure(move(service, "received"));
    expect(error).toBeInstanceOf(ValidationError);
    expect(fieldsOf(error)).toEqual({ defectConfirmed: "Record whether the defect is confirmed" });
    expect(repo.transitions).toEqual([]);
  });

  it("records the finding with the move to received", async () => {
    const { service, repo } = setup([request({ status: "in_transit" })]);
    await move(service, "received", false);
    expect(repo.transitions).toEqual([[1, "in_transit", "received", false]]);
  });

  it("refuses a finding on any other move", async () => {
    const { service } = setup([request({ status: "submitted" })]);
    const error = await failure(service.transition(1, "approved", undefined, AGENT, true));
    expect(fieldsOf(error)).toHaveProperty("defectConfirmed");
  });

  it("refuses a finding on a return", async () => {
    const { service } = setup([request({ kind: "return", status: "in_transit" })]);
    const error = await failure(move(service, "received", true));
    expect(fieldsOf(error)).toEqual({ defectConfirmed: "Only a complaint records a finding" });
  });

  it("keeps the returns machine for returns", async () => {
    const { service } = setup([request({ kind: "return", status: "received" })]);
    expect(await failure(move(service, "in_service"))).toBeInstanceOf(ConflictError);
  });
});

describe("complaint list values", () => {
  it("shows the statutory deadline, days left and the escalation from day 10", async () => {
    const { service } = setup([
      request({ id: 1, createdAt: new Date("2026-10-24T10:00:00Z") }),
      request({ id: 2, createdAt: new Date("2026-11-04T10:00:00Z") }),
      request({ id: 3, createdAt: new Date("2026-10-24T10:00:00Z"), status: "approved" }),
    ]);
    const [old, fresh, answered] = await service.list();
    expect(old).toMatchObject({ escalated: true, daysLeft: 2, overdue: false });
    expect(old?.dueAt.toISOString()).toBe("2026-11-07T11:00:00.000Z");
    expect(fresh).toMatchObject({ escalated: false, daysLeft: 13 });
    expect(answered).toMatchObject({ escalated: false, daysLeft: null, overdue: false });
  });

  it("marks a complaint overdue after day 14", async () => {
    const { service } = setup([request({ createdAt: new Date("2026-10-20T10:00:00Z") })]);
    const [row] = await service.list();
    expect(row).toMatchObject({ overdue: true, escalated: true, daysLeft: -2 });
  });
});
