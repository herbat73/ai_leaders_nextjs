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

const insertAgent = (database: TestDatabase, email: string, tokenHash: string | null = null) =>
  database.query<{ id: number }>(
    `insert into "agents" ("email", "display_name", "invite_token_hash", "created_at", "updated_at") values (?, 'Ala', ?, now(), now()) returning "id"`,
    [email, tokenHash],
  );

async function insertEvent(database: TestDatabase, agentId: number | null): Promise<void> {
  await database.query(
    `insert into "return_requests" ("order_number", "customer_email", "rma", "created_at", "updated_at") values ('O', 'c@example.com', 'RMA-2026-00001', now(), now())`,
  );
  await database.query(
    `insert into "return_request_events" ("return_request_id", "type", "from_status", "to_status", "actor", "agent_id", "created_at") values (1, 'status_changed', 'submitted', 'approved', 'agent', ?, now())`,
    [agentId],
  );
}

describe("Migration20261024192605 up", () => {
  it("creates agents with safe defaults", async () => {
    const database = await migrated();
    const [{ id }] = await insertAgent(database, "ala@example.com");
    const [row] = await database.query<{
      status: string;
      permissions: string[];
      session_epoch: number;
      password_hash: string | null;
    }>(`select "status", "permissions", "session_epoch", "password_hash" from "agents" where "id" = ?`, [id]);
    expect(row).toEqual({ status: "invited", permissions: [], session_epoch: 0, password_hash: null });
  });

  it("enforces a unique e-mail", async () => {
    const database = await migrated();
    await insertAgent(database, "ala@example.com");
    await expect(insertAgent(database, "ala@example.com")).rejects.toThrow(/agents_email_unique/);
  });

  it("enforces a unique invite token hash but allows many nulls", async () => {
    const database = await migrated();
    const hash = "a".repeat(64);
    await insertAgent(database, "a@example.com", hash);
    await expect(insertAgent(database, "b@example.com", hash)).rejects.toThrow(/agents_invite_token_hash_unique/);
    await insertAgent(database, "c@example.com");
    await insertAgent(database, "d@example.com");
  });

  it("adds a nullable agent_id to events that restricts deleting the agent", async () => {
    const database = await migrated();
    const [{ id }] = await insertAgent(database, "ala@example.com");
    await insertEvent(database, id);
    await expect(database.query(`delete from "agents" where "id" = ?`, [id])).rejects.toThrow(/foreign key/i);
  });
});

describe("Migration20261024192605 down", () => {
  const tables = (database: TestDatabase) =>
    database.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = ? and table_name = 'agents'`,
      [database.schema],
    );

  it("drops agents and agent_id when no event records an agent", async () => {
    const database = await migrated();
    const [{ id }] = await insertAgent(database, "ala@example.com");
    await insertEvent(database, null);
    expect(id).toBe(1);

    await database.migrateDown(MIGRATIONS.customerPortal);

    expect(await tables(database)).toEqual([]);
    const columns = await database.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_schema = ? and table_name = 'return_request_events'`,
      [database.schema],
    );
    expect(columns.map((column) => column.column_name)).not.toContain("agent_id");
    expect(await database.query(`select 1 from "return_request_events"`)).toHaveLength(1);
  });

  it("refuses when an event records an agent, and changes nothing", async () => {
    const database = await migrated();
    const [{ id }] = await insertAgent(database, "ala@example.com");
    await insertEvent(database, id);

    await expect(database.migrateDown(MIGRATIONS.customerPortal)).rejects.toThrow(/Refusing to roll back/);

    expect(await tables(database)).toHaveLength(1);
    const [event] = await database.query<{ agent_id: number }>(`select "agent_id" from "return_request_events"`);
    expect(event.agent_id).toBe(id);
  });
});
