import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { formatRma, type ApiLogger } from "@easyrms/core";

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
