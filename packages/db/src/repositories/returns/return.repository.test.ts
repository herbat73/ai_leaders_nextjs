import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ConflictError, formatRma, money, type ApiLogger, type NewReturnRequest } from "@easyrms/core";

import { createTestDatabase, insertLegacyRequest, type TestDatabase } from "../../test-support/postgres";
import { MikroOrmReturnRepository } from "./return.repository";

const NOTE = "Item was used and returned after the period ended";

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.migrateUp();
});

afterAll(async () => {
  await db?.close();
});

function makeLogger() {
  return { error: vi.fn<ApiLogger["error"]>() };
}

/** Each call gets its own fork: its own identity map, and its own connection whenever a transaction opens. */
function repository(logger: ApiLogger = makeLogger()): MikroOrmReturnRepository {
  return new MikroOrmReturnRepository({ em: db.fork(), logger });
}

async function createRequest(order = "ORD-1"): Promise<number> {
  const created = await repository().create({ orderNumber: order, customerEmail: "c@example.com", reason: "Too small" });
  return created.id;
}

const events = (id: number) =>
  db.query<{ type: string; from_status: string | null; to_status: string; note: string | null; actor: string }>(
    `select "type", "from_status", "to_status", "note", "actor" from "return_request_events" where "return_request_id" = ? order by "id"`,
    [id],
  );

const storedNote = async (id: number) =>
  (await db.query<{ decision_note: string | null }>(`select "decision_note" from "return_requests" where "id" = ?`, [id]))[0]
    .decision_note;

describe("create", () => {
  it("assigns a sequence-backed RMA, starts as submitted and writes the submitted event", async () => {
    const created = await repository().create({ orderNumber: "ORD-9", customerEmail: "c@example.com", reason: "Damaged" });

    expect(created).toMatchObject({ status: "submitted", kind: "return", hasDecisionNote: false });
    expect(created.rma).toBe(formatRma(Number(created.rma.split("-")[2]), created.createdAt));
    expect(await events(created.id)).toEqual([
      { type: "submitted", from_status: null, to_status: "submitted", note: null, actor: "system" },
    ]);
  });

  it("hands out distinct, increasing RMAs to concurrent creates", async () => {
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, index) => repository().create({ orderNumber: `C-${index}`, customerEmail: "c@example.com", reason: "r" })),
    );

    const numbers = created.map((request) => Number(request.rma.split("-")[2]));
    expect(new Set(numbers).size).toBe(8);
  });

  it("joins the caller's transaction, so rolling it back leaves neither the row nor the event", async () => {
    const em = db.fork();
    const before = await db.query(`select 1 from "return_requests"`);

    await expect(
      em.transactional(async (tx) => {
        await new MikroOrmReturnRepository({ em: tx, logger: makeLogger() }).create({
          orderNumber: "ROLLED-BACK",
          customerEmail: "c@example.com",
          reason: "r",
        });
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");

    expect(await db.query(`select 1 from "return_requests"`)).toHaveLength(before.length);
    expect(await db.query(`select 1 from "return_requests" where "order_number" = 'ROLLED-BACK'`)).toHaveLength(0);
  });
});

describe("transition", () => {
  it("moves the status, stamps updated_at and writes one event", async () => {
    const id = await createRequest();
    const [{ updated_at: before }] = await db.query<{ updated_at: Date | string }>(`select "updated_at" from "return_requests" where "id" = ?`, [id]);
    await new Promise((resolve) => setTimeout(resolve, 5));

    const outcome = await repository().transition(id, "submitted", "approved", NOTE);

    expect(outcome).toMatchObject({ result: "moved", request: { id, status: "approved", hasDecisionNote: true } });
    const [{ updated_at: after }] = await db.query<{ updated_at: Date | string }>(`select "updated_at" from "return_requests" where "id" = ?`, [id]);
    expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime());
    expect(await events(id)).toHaveLength(2);
    expect((await events(id))[1]).toEqual({
      type: "status_changed",
      from_status: "submitted",
      to_status: "approved",
      note: NOTE,
      actor: "agent",
    });
    expect(await storedNote(id)).toBe(NOTE);
  });

  it("does not clear the decision note when a later, non-decision move happens", async () => {
    const id = await createRequest();
    await repository().transition(id, "submitted", "approved", NOTE);

    await repository().transition(id, "approved", "in_transit", null);
    await repository().transition(id, "in_transit", "received", null);

    expect(await storedNote(id)).toBe(NOTE);
    expect((await repository().findDetail(id))?.request.hasDecisionNote).toBe(true);
  });

  it("stores no note for an approval without one", async () => {
    const id = await createRequest();

    const outcome = await repository().transition(id, "submitted", "approved", null);

    expect(outcome).toMatchObject({ result: "moved", request: { hasDecisionNote: false } });
    expect(await storedNote(id)).toBeNull();
  });

  it("returns conflict with the stored status and writes no event when `from` is stale", async () => {
    const id = await createRequest();
    await repository().transition(id, "submitted", "approved", null);

    const outcome = await repository().transition(id, "submitted", "rejected", NOTE);

    expect(outcome).toEqual({ result: "conflict", currentStatus: "approved" });
    expect(await events(id)).toHaveLength(2);
    expect(await storedNote(id)).toBeNull();
  });

  it("returns not_found for an unknown id", async () => {
    expect(await repository().transition(987654, "submitted", "approved", null)).toEqual({ result: "not_found" });
  });

  it("reports a stale status from a fork that has already loaded the row (identity map is bypassed)", async () => {
    const id = await createRequest();
    const stale = new MikroOrmReturnRepository({ em: db.fork(), logger: makeLogger() });
    expect(await stale.findStatus(id)).toBe("submitted");
    await repository().transition(id, "submitted", "approved", null);

    expect(await stale.transition(id, "submitted", "rejected", NOTE)).toEqual({ result: "conflict", currentStatus: "approved" });
  });

  it("lets exactly one of two concurrent moves win, and the loser sees the winner's status", async () => {
    const id = await createRequest();

    const outcomes = await Promise.all([
      repository().transition(id, "submitted", "approved", null),
      repository().transition(id, "submitted", "rejected", NOTE),
    ]);

    const moved = outcomes.filter((outcome) => outcome.result === "moved");
    const conflicts = outcomes.filter((outcome) => outcome.result === "conflict");
    expect(moved).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    const winner = moved[0].result === "moved" ? moved[0].request.status : undefined;
    expect(conflicts[0]).toEqual({ result: "conflict", currentStatus: winner });
    expect(await events(id)).toHaveLength(2);
  });

  it("repeats the race many times without ever writing a second event", async () => {
    const ids = await Promise.all(Array.from({ length: 6 }, (_, index) => createRequest(`RACE-${index}`)));

    await Promise.all(
      ids.flatMap((id) => [
        repository().transition(id, "submitted", "approved", null),
        repository().transition(id, "submitted", "rejected", NOTE),
        repository().transition(id, "submitted", "approved", null),
      ]),
    );

    for (const id of ids) expect(await events(id)).toHaveLength(2);
  });
});

describe("reads", () => {
  it("findDetail returns the note and the events oldest first; findStatus reads the status alone", async () => {
    const id = await createRequest();
    await repository().transition(id, "submitted", "approved", NOTE);
    await repository().transition(id, "approved", "in_transit", null);

    const detail = await repository().findDetail(id);

    expect(detail?.decisionNote).toBe(NOTE);
    expect(detail?.events.map((event) => [event.type, event.toStatus, event.actor])).toEqual([
      ["submitted", "submitted", "system"],
      ["status_changed", "approved", "agent"],
      ["status_changed", "in_transit", "agent"],
    ]);
    expect(await repository().findStatus(id)).toBe("in_transit");
    expect(await repository().findDetail(987654)).toBeNull();
    expect(await repository().findStatus(987654)).toBeNull();
  });

  it("list never carries the note text, filters by status and orders newest first", async () => {
    const id = await createRequest("LIST-1");
    await repository().transition(id, "submitted", "approved", NOTE);
    const newer = await createRequest("LIST-2");

    const all = await repository().list();
    const approved = await repository().list({ status: "approved" });

    expect(JSON.stringify(all)).not.toContain(NOTE);
    expect(all.findIndex((request) => request.id === newer)).toBeLessThan(all.findIndex((request) => request.id === id));
    expect(approved.every((request) => request.status === "approved")).toBe(true);
    expect(approved.some((request) => request.id === id)).toBe(true);
    expect(approved.some((request) => request.id === newer)).toBe(false);
  });
});

describe("a corrupt status", () => {
  it("is listed as unknown, logged once per call with the row id, never throws, and is found by the unknown filter", async () => {
    const id = await createRequest("CORRUPT");
    await db.query(`update "return_requests" set "status" = 'hand-edited' where "id" = ?`, [id]);
    const logger = makeLogger();

    const all = await repository(logger).list();
    const onlyUnknown = await repository(makeLogger()).list({ status: "unknown" });

    expect(all.find((request) => request.id === id)?.status).toBe("unknown");
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][1]).toMatchObject({ ids: expect.arrayContaining([id]) });
    expect(onlyUnknown.map((request) => request.id)).toContain(id);
    expect(onlyUnknown.every((request) => request.status === "unknown")).toBe(true);
    expect(await repository().findStatus(id)).toBe("unknown");
    expect(await repository().transition(id, "submitted", "approved", null)).toEqual({ result: "conflict", currentStatus: "unknown" });
  });
});

describe("after the migration", () => {
  it("continues the RMA sequence after the backfilled rows", async () => {
    const fresh = await createTestDatabase();
    try {
      await fresh.migrateUp("Migration20261013164552");
      await insertLegacyRequest(fresh, { status: "requested", createdAt: "2026-03-01T10:00:00Z" });
      await insertLegacyRequest(fresh, { status: "refunded", createdAt: "2026-03-02T10:00:00Z" });
      await fresh.migrateUp();

      const created = await new MikroOrmReturnRepository({ em: fresh.fork(), logger: makeLogger() }).create({
        orderNumber: "NEW",
        customerEmail: "c@example.com",
        reason: "r",
      });

      expect(Number(created.rma.split("-")[2])).toBe(3);
    } finally {
      await fresh.close();
    }
  });
});

const KEY = "11111111-1111-4111-8111-111111111111";

function portalInput(order: string, overrides: Partial<NewReturnRequest> = {}): NewReturnRequest {
  return {
    orderNumber: order,
    customerEmail: "c@example.com",
    items: [
      { lineRef: "L1", sku: "SKU-1", name: "Shoe", quantity: 2, unitPrice: money(19990), reasonCode: "size", comment: "Too small" },
      { lineRef: "L2", sku: "SKU-2", name: "Sock", quantity: 1, unitPrice: money(1999), reasonCode: "mistake" },
    ],
    resolution: "refund",
    resolutionAmount: money(41969),
    returnMethod: "parcel_locker",
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

describe("createWithItems", () => {
  it("writes the request, its items, the RMA and the submitted event in one go", async () => {
    const created = await repository().createWithItems(portalInput("P-1", { idempotencyKey: KEY }));

    expect(created).toMatchObject({
      status: "submitted",
      reason: null,
      resolution: "refund",
      resolutionAmount: money(41969),
      returnMethod: "parcel_locker",
      exchangeNote: null,
    });
    expect(created.rma).toBe(formatRma(Number(created.rma.split("-")[2]), created.createdAt));
    expect(await events(created.id)).toEqual([
      { type: "submitted", from_status: null, to_status: "submitted", note: null, actor: "system" },
    ]);
    const rows = await db.query<{ line_ref: string; quantity: number; unit_price: string; reason_code: string; comment: string | null }>(
      `select "line_ref", "quantity", "unit_price", "reason_code", "comment" from "return_request_items" where "return_request_id" = ? order by "id"`,
      [created.id],
    );
    expect(rows).toEqual([
      { line_ref: "L1", quantity: 2, unit_price: "199.90", reason_code: "size", comment: "Too small" },
      { line_ref: "L2", quantity: 1, unit_price: "19.99", reason_code: "mistake", comment: null },
    ]);
  });

  it("stores a null amount and the note for an exchange", async () => {
    const created = await repository().createWithItems(
      portalInput("P-2", { resolution: "exchange", resolutionAmount: null, exchangeNote: "Size 42" }),
    );
    expect(created).toMatchObject({ resolution: "exchange", resolutionAmount: null, exchangeNote: "Size 42" });
  });

  it("maps a reused idempotency key (even from another order) to ConflictError and leaves no second row", async () => {
    const key = randomUUID();
    await repository().createWithItems(portalInput("P-3", { idempotencyKey: key }));

    await expect(repository().createWithItems(portalInput("P-3-other", { idempotencyKey: key }))).rejects.toBeInstanceOf(ConflictError);
    const rows = await db.query(`select 1 from "return_requests" where "idempotency_key" = ?`, [key]);
    expect(rows).toHaveLength(1);
    expect(await db.query(`select 1 from "return_requests" where "order_number" = 'P-3-other'`)).toHaveLength(0);
  });
});

describe("findByIdempotencyKey, findByRma, findDetail", () => {
  it("find the request by key and by RMA, with items and events", async () => {
    const key = randomUUID();
    const created = await repository().createWithItems(portalInput("P-4", { idempotencyKey: key }));

    expect(await repository().findByIdempotencyKey(key)).toMatchObject({ id: created.id, rma: created.rma });
    expect(await repository().findByIdempotencyKey(randomUUID())).toBeNull();

    for (const detail of [await repository().findByRma(created.rma), await repository().findDetail(created.id)]) {
      expect(detail?.request.id).toBe(created.id);
      expect(detail?.items.map((item) => item.lineRef)).toEqual(["L1", "L2"]);
      expect(detail?.items[0]).toEqual({
        lineRef: "L1",
        sku: "SKU-1",
        name: "Shoe",
        quantity: 2,
        unitPrice: money(19990),
        reasonCode: "size",
        comment: "Too small",
      });
      expect(detail?.events.map((event) => event.type)).toEqual(["submitted"]);
    }
    expect(await repository().findByRma("RMA-0000-00000")).toBeNull();
  });

  it("returns no items for a legacy request", async () => {
    const id = await createRequest("P-5");
    expect((await repository().findDetail(id))?.items).toEqual([]);
  });
});

describe("listByOrder", () => {
  it("lists only that order's requests, newest first", async () => {
    const first = await repository().createWithItems(portalInput("P-6"));
    const second = await repository().createWithItems(portalInput("P-6"));
    await repository().createWithItems(portalInput("P-6-other"));

    const listed = await repository().listByOrder("P-6");
    expect(listed.map((request) => request.id)).toEqual([second.id, first.id]);
    expect(await repository().listByOrder("P-none")).toEqual([]);
  });
});

describe("claimedQuantities", () => {
  it("sums per line, and cancelled or rejected requests release their quantity", async () => {
    const kept = await repository().createWithItems(portalInput("Q-1"));
    const cancelled = await repository().createWithItems(portalInput("Q-1"));
    const rejected = await repository().createWithItems(portalInput("Q-1"));
    await repository().createWithItems(portalInput("Q-1-other"));
    expect(await repository().claimedQuantities("Q-1")).toEqual({ L1: 6, L2: 3 });

    await repository().transition(cancelled.id, "submitted", "cancelled", null);
    await repository().transition(rejected.id, "submitted", "rejected", "Not eligible for return here");
    expect(await repository().claimedQuantities("Q-1")).toEqual({ L1: 2, L2: 1 });

    await repository().transition(kept.id, "submitted", "approved", null);
    expect(await repository().claimedQuantities("Q-1")).toEqual({ L1: 2, L2: 1 });
    expect(await repository().claimedQuantities("Q-empty")).toEqual({});
  });
});

describe("withOrderLock", () => {
  it("hands a transaction-scoped repository to the callback and commits on success", async () => {
    const result = await repository().withOrderLock("W-1", async (tx) => {
      const created = await tx.createWithItems(portalInput("W-1"));
      return (await tx.listByOrder("W-1")).map((request) => request.id === created.id);
    });

    expect(result).toEqual([true]);
    expect(await db.query(`select 1 from "return_requests" where "order_number" = 'W-1'`)).toHaveLength(1);
  });

  it("rolls everything back when the callback throws", async () => {
    await expect(
      repository().withOrderLock("W-2", async (tx) => {
        await tx.createWithItems(portalInput("W-2"));
        await tx.create({ orderNumber: "W-2", customerEmail: "c@example.com", reason: "r" });
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");

    expect(await db.query(`select 1 from "return_requests" where "order_number" = 'W-2'`)).toHaveLength(0);
    expect(await db.query(`select 1 from "return_request_items" where "line_ref" = 'L1' and "return_request_id" not in (select "id" from "return_requests")`)).toHaveLength(0);
  });

  it("runs the callback inside one transaction that holds the advisory lock", async () => {
    const held = await repository().withOrderLock("W-3", async (tx) => {
      await tx.createWithItems(portalInput("W-3"));
      return db.query(`select 1 from "pg_locks" where "locktype" = 'advisory' and "granted" and "database" = (select "oid" from "pg_database" where "datname" = current_database())`);
    });
    expect(held.length).toBeGreaterThan(0);
    expect(await db.query(`select 1 from "pg_locks" where "locktype" = 'advisory' and "granted" and "database" = (select "oid" from "pg_database" where "datname" = current_database())`)).toHaveLength(0);
  });
});
