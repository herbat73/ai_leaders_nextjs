import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase, MIGRATIONS, type TestDatabase } from "../test-support/postgres";

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.migrateUp();
});

afterAll(async () => {
  await db?.close();
});

describe("rule comparisons migration", () => {
  it("creates the table with restrict foreign keys", async () => {
    const columns = await db.query<{ column_name: string }>(
      `select "column_name" from information_schema.columns where "table_schema" = current_schema() and "table_name" = 'return_rule_comparisons' order by "ordinal_position"`,
    );
    expect(columns.map((column) => column.column_name)).toEqual([
      "id", "return_request_id", "agent_id", "recommended", "rule_ids", "actual_status", "followed", "created_at",
    ]);
    const rules = await db.query<{ delete_rule: string }>(
      `select rc."delete_rule" from information_schema.referential_constraints rc where rc."constraint_schema" = current_schema() and rc."constraint_name" like 'return_rule_comparisons_%_foreign'`,
    );
    expect(rules).toHaveLength(2);
    expect(rules.every((rule) => rule.delete_rule === "RESTRICT")).toBe(true);
  });

  it("rolls back when empty and refuses once a decision is recorded", async () => {
    await db.migrateDown(MIGRATIONS.agentAcceptedAt);
    expect(await db.query(`select to_regclass('return_rule_comparisons') as "name"`)).toEqual([{ name: null }]);
    await db.migrateUp();

    const [{ id: agentId }] = await db.query<{ id: number }>(
      `insert into "agents" ("email", "display_name", "status", "created_at", "updated_at") values ('a@example.com', 'A', 'active', now(), now()) returning "id"`,
    );
    const [{ id: requestId }] = await db.query<{ id: number }>(
      `insert into "return_requests" ("order_number", "customer_email", "rma", "created_at", "updated_at") values ('O-1', 'c@example.com', 'RMA-2026-00001', now(), now()) returning "id"`,
    );
    await db.query(
      `insert into "return_rule_comparisons" ("return_request_id", "agent_id", "recommended", "actual_status", "created_at") values (?, ?, 'none', 'rejected', now())`,
      [requestId, agentId],
    );

    await expect(db.migrateDown(MIGRATIONS.agentAcceptedAt)).rejects.toThrow(/Refusing to roll back/);
    expect(await db.query(`select 1 from "return_rule_comparisons"`)).toHaveLength(1);
  });
});
