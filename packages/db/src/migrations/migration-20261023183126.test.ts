import { afterEach, describe, expect, it } from "vitest";
import { formatRma } from "@easyrms/core";

import { createTestDatabase, insertLegacyRequest, MIGRATIONS, type TestDatabase } from "../test-support/postgres";

interface RequestRow {
  id: number;
  rma: string;
  status: string;
  kind: string;
  created_at: Date | string;
}

let db: TestDatabase | undefined;

afterEach(async () => {
  await db?.close();
  db = undefined;
});

async function legacyDatabase(): Promise<TestDatabase> {
  db = await createTestDatabase();
  await db.migrateUp(MIGRATIONS.initial);
  return db;
}

const requests = (database: TestDatabase) =>
  database.query<RequestRow>(`select "id", "rma", "status", "kind", "created_at" from "return_requests" order by "id"`);

describe("Migration20261023183126 up", () => {
  it("maps legacy statuses, leaves the rest alone and keeps a corrupt value out of the nine", async () => {
    const database = await legacyDatabase();
    for (const [index, status] of ["requested", "refunded", "approved", "rejected", "received", "weird"].entries()) {
      await insertLegacyRequest(database, { status, createdAt: `2026-03-0${index + 1}T10:00:00Z` });
    }

    await database.migrateUp();

    expect((await requests(database)).map((row) => row.status)).toEqual([
      "submitted",
      "resolved",
      "approved",
      "rejected",
      "received",
      "weird",
    ]);
    expect((await requests(database)).every((row) => row.kind === "return")).toBe(true);
  });

  it("numbers RMAs by created_at then id, so equal timestamps are ordered by id", async () => {
    const database = await legacyDatabase();
    // ids 1..4: the newest first, then two rows with the same created_at, then the oldest
    await insertLegacyRequest(database, { status: "requested", createdAt: "2026-05-01T10:00:00Z" });
    await insertLegacyRequest(database, { status: "requested", createdAt: "2026-04-01T10:00:00Z" });
    await insertLegacyRequest(database, { status: "requested", createdAt: "2026-04-01T10:00:00Z" });
    await insertLegacyRequest(database, { status: "requested", createdAt: "2026-03-01T10:00:00Z" });

    await database.migrateUp();

    expect((await requests(database)).map((row) => row.rma)).toEqual([
      "RMA-2026-00004",
      "RMA-2026-00002",
      "RMA-2026-00003",
      "RMA-2026-00001",
    ]);
  });

  it("gives every backfilled row exactly formatRma(seq, created_at), including the Warsaw year boundary", async () => {
    const database = await legacyDatabase();
    await insertLegacyRequest(database, { status: "requested", createdAt: "2026-12-31T22:59:00Z" });
    await insertLegacyRequest(database, { status: "requested", createdAt: "2026-12-31T23:30:00Z" });
    await insertLegacyRequest(database, { status: "requested", createdAt: "2025-06-01T10:00:00Z" });

    await database.migrateUp();

    const rows = await requests(database);
    const ordered = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id - b.id);
    ordered.forEach((row, index) => expect(row.rma).toBe(formatRma(index + 1, new Date(row.created_at))));
    expect(rows.find((row) => row.id === 2)?.rma).toBe("RMA-2027-00003");
  });

  it("does not truncate past 99999 (no lpad) and continues the sequence after the last backfilled value", async () => {
    const database = await legacyDatabase();
    await database.query(
      `insert into "return_requests" ("order_number", "customer_email", "reason", "status", "created_at", "updated_at")
       select 'ORD', 'c@example.com', 'r', 'requested', timestamptz '2026-03-01 10:00:00+00' + (n || ' seconds')::interval, now()
       from generate_series(1, 100001) as n`,
    );

    await database.migrateUp();

    const [{ rma }] = await database.query<{ rma: string }>(
      `select "rma" from "return_requests" order by "created_at" desc limit 1`,
    );
    expect(rma).toBe("RMA-2026-100001");
    const [{ next }] = await database.query<{ next: string }>(`select nextval('return_rma_seq') as "next"`);
    expect(Number(next)).toBe(100002);
  });

  it("synthesizes one submitted event per row, dated created_at, written by the system", async () => {
    const database = await legacyDatabase();
    await insertLegacyRequest(database, { status: "requested", createdAt: "2026-03-01T10:00:00Z" });
    await insertLegacyRequest(database, { status: "approved", createdAt: "2026-03-02T10:00:00Z" });

    await database.migrateUp();

    const events = await database.query<{ return_request_id: number; type: string; to_status: string; actor: string; created_at: Date | string }>(
      `select * from "return_request_events" order by "return_request_id"`,
    );
    expect(events).toHaveLength(2);
    expect(events.map((event) => [event.type, event.to_status, event.actor])).toEqual([
      ["submitted", "submitted", "system"],
      ["submitted", "submitted", "system"],
    ]);
    expect(new Date(events[1].created_at).toISOString()).toBe("2026-03-02T10:00:00.000Z");
  });

  it("works on an empty table", async () => {
    const database = await legacyDatabase();

    await database.migrateUp();

    expect(await requests(database)).toEqual([]);
  });

  it("enforces a unique, not-null rma afterwards", async () => {
    const database = await legacyDatabase();
    await insertLegacyRequest(database, { status: "requested", createdAt: "2026-03-01T10:00:00Z" });
    await database.migrateUp();

    await expect(
      database.query(
        `insert into "return_requests" ("order_number", "customer_email", "reason", "rma", "created_at", "updated_at") values ('O', 'e@x.com', 'r', 'RMA-2026-00001', now(), now())`,
      ),
    ).rejects.toThrow(/unique/i);
    await expect(
      database.query(
        `insert into "return_requests" ("order_number", "customer_email", "reason", "created_at", "updated_at") values ('O', 'e@x.com', 'r', now(), now())`,
      ),
    ).rejects.toThrow(/null/i);
  });
});

describe("Migration20261023183126 down", () => {
  it("restores the old columns and statuses while only synthesized events exist", async () => {
    const database = await legacyDatabase();
    await insertLegacyRequest(database, { status: "requested", createdAt: "2026-03-01T10:00:00Z" });
    await insertLegacyRequest(database, { status: "refunded", createdAt: "2026-03-02T10:00:00Z" });
    await database.migrateUp();

    await database.migrateDown();

    const columns = await database.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_schema = ? and table_name = 'return_requests'`,
      [database.schema],
    );
    expect(columns.map((column) => column.column_name)).not.toContain("rma");
    expect((await database.query<{ status: string }>(`select "status" from "return_requests" order by "id"`)).map((row) => row.status)).toEqual([
      "requested",
      "refunded",
    ]);
  });

  it("refuses after an agent moved a request, and changes nothing", async () => {
    const database = await legacyDatabase();
    await insertLegacyRequest(database, { status: "requested", createdAt: "2026-03-01T10:00:00Z" });
    await database.migrateUp();
    await database.query(`update "return_requests" set "status" = 'approved', "decision_note" = 'kept' where "id" = 1`);
    await database.query(
      `insert into "return_request_events" ("return_request_id", "type", "from_status", "to_status", "note", "actor", "created_at") values (1, 'status_changed', 'submitted', 'approved', 'kept', 'agent', now())`,
    );

    await expect(database.migrateDown()).rejects.toThrow(/forward-only/);

    const [row] = await database.query<{ status: string; decision_note: string; rma: string }>(
      `select "status", "decision_note", "rma" from "return_requests"`,
    );
    expect(row).toMatchObject({ status: "approved", decision_note: "kept", rma: "RMA-2026-00001" });
    expect(await database.query(`select 1 from "return_request_events" where "type" = 'status_changed'`)).toHaveLength(1);
  });

  it.each(["awaiting_customer", "in_transit", "in_service", "cancelled"])(
    "refuses when a request is already in %s, even without a recorded move",
    async (status) => {
      const database = await legacyDatabase();
      await insertLegacyRequest(database, { status: "requested", createdAt: "2026-03-01T10:00:00Z" });
      await database.migrateUp();
      await database.query(`update "return_requests" set "status" = ?`, [status]);

      await expect(database.migrateDown()).rejects.toThrow(/forward-only/);
    },
  );
});
