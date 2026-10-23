import { afterEach, describe, expect, it } from "vitest";

import { createTestDatabase, MIGRATIONS, type TestDatabase } from "../test-support/postgres";

let db: TestDatabase | undefined;

afterEach(async () => {
  await db?.close();
  db = undefined;
});

async function migrated(): Promise<TestDatabase> {
  db = await createTestDatabase();
  await db.migrateUp();
  return db;
}

const KEY_A = "11111111-1111-4111-8111-111111111111";

async function insertRequest(
  database: TestDatabase,
  row: { rma: string; order?: string; reason?: string | null; key?: string | null },
): Promise<number> {
  const [{ id }] = await database.query<{ id: number }>(
    `insert into "return_requests" ("rma", "order_number", "customer_email", "reason", "idempotency_key", "created_at", "updated_at") values (?, ?, 'c@example.com', ?, ?, now(), now()) returning "id"`,
    [row.rma, row.order ?? "ORD-1", row.reason ?? null, row.key ?? null],
  );
  return id;
}

const insertItem = (database: TestDatabase, requestId: number, lineRef: string) =>
  database.query(
    `insert into "return_request_items" ("return_request_id", "line_ref", "sku", "name", "quantity", "unit_price", "reason_code") values (?, ?, 'SKU', 'Shoe', 2, 199.90, 'size')`,
    [requestId, lineRef],
  );

describe("Migration20261023202921 up", () => {
  it("stores and reads items and the new request columns", async () => {
    const database = await migrated();
    const id = await insertRequest(database, { rma: "RMA-2026-00001" });
    await database.query(`update "return_requests" set "resolution" = 'refund', "resolution_amount" = 399.80, "return_method" = 'courier', "exchange_note" = 'n' where "id" = ?`, [id]);
    await insertItem(database, id, "L1");

    const [request] = await database.query<{ resolution_amount: string; currency: string; reason: string | null }>(
      `select "resolution_amount", "currency", "reason" from "return_requests"`,
    );
    expect(request).toMatchObject({ resolution_amount: "399.80", currency: "PLN", reason: null });
    const [item] = await database.query<{ unit_price: string; comment: string | null }>(`select * from "return_request_items"`);
    expect(item).toMatchObject({ unit_price: "199.90", comment: null });
  });

  it("rejects a duplicate (return_request_id, line_ref) but allows the same line on another request", async () => {
    const database = await migrated();
    const first = await insertRequest(database, { rma: "RMA-2026-00001" });
    const second = await insertRequest(database, { rma: "RMA-2026-00002" });
    await insertItem(database, first, "L1");

    await expect(insertItem(database, first, "L1")).rejects.toThrow(/unique/i);
    await insertItem(database, second, "L1");
  });

  it("rejects a duplicate idempotency_key but allows many null keys", async () => {
    const database = await migrated();
    await insertRequest(database, { rma: "RMA-2026-00001", key: KEY_A });
    await insertRequest(database, { rma: "RMA-2026-00002" });
    await insertRequest(database, { rma: "RMA-2026-00003" });

    await expect(insertRequest(database, { rma: "RMA-2026-00004", key: KEY_A })).rejects.toThrow(/unique/i);
  });

  it("restricts deleting a request that has items and creates the order_number and line_ref indexes", async () => {
    const database = await migrated();
    const id = await insertRequest(database, { rma: "RMA-2026-00001" });
    await insertItem(database, id, "L1");

    await expect(database.query(`delete from "return_requests" where "id" = ?`, [id])).rejects.toThrow(/foreign key/i);
    const indexes = await database.query<{ indexname: string }>(`select indexname from pg_indexes where schemaname = ?`, [database.schema]);
    expect(indexes.map((index) => index.indexname)).toEqual(
      expect.arrayContaining(["return_requests_order_number_index", "return_request_items_line_ref_index"]),
    );
  });

  it("keeps legacy rows readable with their reason", async () => {
    db = await createTestDatabase();
    await db.migrateUp(MIGRATIONS.agentDecision);
    await db.query(
      `insert into "return_requests" ("rma", "order_number", "customer_email", "reason", "created_at", "updated_at") values ('RMA-2026-00001', 'O', 'c@example.com', 'Too small', now(), now())`,
    );

    await db.migrateUp();

    const [row] = await db.query<{ reason: string; currency: string }>(`select "reason", "currency" from "return_requests"`);
    expect(row).toEqual({ reason: "Too small", currency: "PLN" });
  });
});

describe("Migration20261023202921 down", () => {
  const columnNames = async (database: TestDatabase): Promise<string[]> =>
    (
      await database.query<{ column_name: string }>(
        `select column_name from information_schema.columns where table_schema = ? and table_name = 'return_requests'`,
        [database.schema],
      )
    ).map((column) => column.column_name);

  const reasonNullable = async (database: TestDatabase): Promise<boolean> =>
    (
      await database.query<{ is_nullable: string }>(
        `select is_nullable from information_schema.columns where table_schema = ? and table_name = 'return_requests' and column_name = 'reason'`,
        [database.schema],
      )
    )[0].is_nullable === "YES";

  it("drops the table and columns and restores reason not null when no reason is null", async () => {
    const database = await migrated();
    await insertRequest(database, { rma: "RMA-2026-00001", reason: "Too small" });

    await database.migrateDown();

    const columns = await columnNames(database);
    for (const dropped of ["resolution", "resolution_amount", "currency", "exchange_note", "return_method", "idempotency_key"]) {
      expect(columns).not.toContain(dropped);
    }
    expect(await database.query(`select to_regclass('return_request_items') as "t"`)).toEqual([{ t: null }]);
    expect(await reasonNullable(database)).toBe(false);
    expect(await database.query(`select "reason" from "return_requests"`)).toEqual([{ reason: "Too small" }]);
  });

  it("refuses when a row has a null reason and changes nothing", async () => {
    const database = await migrated();
    const id = await insertRequest(database, { rma: "RMA-2026-00001", reason: null, key: KEY_A });
    await insertItem(database, id, "L1");

    await expect(database.migrateDown()).rejects.toThrow(/Refusing to roll back.*Nothing was changed/);

    const columns = await columnNames(database);
    expect(columns).toEqual(expect.arrayContaining(["resolution", "currency", "idempotency_key"]));
    expect(await reasonNullable(database)).toBe(true);
    expect(await database.query(`select "line_ref" from "return_request_items"`)).toEqual([{ line_ref: "L1" }]);
    expect(await database.query(`select "idempotency_key" from "return_requests"`)).toEqual([{ idempotency_key: KEY_A }]);
    const executed = await database.query<{ name: string }>(`select "name" from "mikro_orm_migrations"`);
    expect(executed.map((row) => row.name)).toContain(MIGRATIONS.customerPortal);
  });
});
