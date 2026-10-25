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

const insertRequest = (database: TestDatabase, kind: string, rma: string) =>
  database.query<{ id: number }>(
    `insert into "return_requests" ("order_number", "customer_email", "rma", "kind", "created_at", "updated_at") values ('O', 'c@example.com', ?, ?, now(), now()) returning "id"`,
    [rma, kind],
  );

describe("Migration20261025180000 up", () => {
  it("leaves existing rows with null defect fields", async () => {
    db = await createTestDatabase();
    await db.migrateUp(MIGRATIONS.agentLogin);
    await insertRequest(db, "return", "RMA-2026-00001");
    await db.migrateUp();

    const [row] = await db.query(
      `select "defect_description", "defect_discovered_on", "defect_confirmed" from "return_requests"`,
    );
    expect(row).toEqual({ defect_description: null, defect_discovered_on: null, defect_confirmed: null });
  });

  it("adds a nullable serial number to items", async () => {
    const database = await migrated();
    const [{ id }] = await insertRequest(database, "complaint", "RMA-2026-00002");
    await database.query(
      `insert into "return_request_items" ("return_request_id", "line_ref", "sku", "name", "quantity", "unit_price", "reason_code") values (?, 'L1', 'S', 'N', 1, 10.00, 'defective')`,
      [id],
    );
    const [item] = await database.query(`select "serial_number" from "return_request_items"`);
    expect(item).toEqual({ serial_number: null });
  });
});

describe("Migration20261025180000 down", () => {
  it("drops the columns while no complaint exists", async () => {
    const database = await migrated();
    await insertRequest(database, "return", "RMA-2026-00003");
    await database.migrateDown(MIGRATIONS.agentLogin);

    const columns = await database.query<{ column_name: string }>(
      `select "column_name" from information_schema.columns where table_schema = ? and table_name = 'return_requests'`,
      [database.schema],
    );
    expect(columns.map((c) => c.column_name)).not.toContain("defect_description");
  });

  it("refuses once a complaint exists and changes nothing", async () => {
    const database = await migrated();
    await insertRequest(database, "complaint", "RMA-2026-00004");
    await expect(database.migrateDown(MIGRATIONS.agentLogin)).rejects.toThrow(/Refusing to roll back/);

    const [row] = await database.query(`select "defect_description" from "return_requests"`);
    expect(row).toEqual({ defect_description: null });
  });
});
