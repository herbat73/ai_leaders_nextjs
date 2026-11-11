import { afterEach, describe, expect, it } from "vitest";

import { createTestDatabase, MIGRATIONS, type TestDatabase } from "../test-support/postgres";

let db: TestDatabase | undefined;

afterEach(async () => {
  await db?.close();
  db = undefined;
});

const insertRequest = (database: TestDatabase, kind: string, rma: string) =>
  database.query<{ id: number }>(
    `insert into "return_requests" ("order_number", "customer_email", "rma", "kind", "created_at", "updated_at") values ('O', 'c@example.com', ?, ?, now(), now()) returning "id"`,
    [rma, kind],
  );

const columns = (database: TestDatabase) =>
  database.query<{ column_name: string; is_nullable: string }>(
    `select "column_name", "is_nullable" from information_schema.columns where table_schema = ? and table_name = 'return_requests'`,
    [database.schema],
  );

describe("Migration20261111090000 up", () => {
  it("adds a nullable courier note and leaves existing rows null", async () => {
    db = await createTestDatabase();
    await db.migrateUp(MIGRATIONS.ruleComparisons);
    await insertRequest(db, "complaint", "RMA-2026-00001");
    await db.migrateUp();

    const note = (await columns(db)).find((column) => column.column_name === "courier_note");
    expect(note?.is_nullable).toBe("YES");
    expect(await db.query(`select "courier_note" from "return_requests"`)).toEqual([{ courier_note: null }]);
  });

  it("accepts the new kind and resolution values in the existing varchar columns", async () => {
    db = await createTestDatabase();
    await db.migrateUp();
    await db.query(
      `insert into "return_requests" ("order_number", "customer_email", "rma", "kind", "resolution", "courier_note", "created_at", "updated_at") values ('O', 'c@example.com', 'RMA-2026-00002', 'transport', 'resend_part', true, now(), now())`,
    );
    expect(await db.query(`select "kind", "resolution", "return_method" from "return_requests"`)).toEqual([
      { kind: "transport", resolution: "resend_part", return_method: null },
    ]);
  });
});

describe("Migration20261111090000 down", () => {
  it("drops the column while no transport or missing request exists", async () => {
    db = await createTestDatabase();
    await db.migrateUp();
    await insertRequest(db, "return", "RMA-2026-00003");
    await db.migrateDown(MIGRATIONS.ruleComparisons);
    expect((await columns(db)).map((column) => column.column_name)).not.toContain("courier_note");
  });

  it.each(["transport", "missing"])("refuses once a %s request exists and changes nothing", async (kind) => {
    db = await createTestDatabase();
    await db.migrateUp();
    await insertRequest(db, kind, "RMA-2026-00004");
    await expect(db.migrateDown(MIGRATIONS.ruleComparisons)).rejects.toThrow(/Refusing to roll back/);
    expect((await columns(db)).map((column) => column.column_name)).toContain("courier_note");
  });
});
