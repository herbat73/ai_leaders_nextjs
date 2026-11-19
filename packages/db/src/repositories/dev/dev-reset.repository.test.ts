import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase, type TestDatabase } from "../../test-support/postgres";
import { MikroOrmDevResetRepository } from "./dev-reset.repository";

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.migrateUp();
});

afterAll(async () => {
  await db?.close();
});

const repository = (): MikroOrmDevResetRepository => new MikroOrmDevResetRepository({ em: db.fork() });
const count = async (table: string): Promise<number> => Number((await db.query<{ n: string }>(`select count(*) as n from "${table}"`))[0].n);

describe("MikroOrmDevResetRepository.truncateAll", () => {
  it("removes the rows of every data table, keeps the migration history and restarts identities", async () => {
    await db.query(`insert into "suppliers" ("name", "email", "active", "created_at", "updated_at") values ('S', 's@example.com', true, now(), now())`);
    await db.query(
      `insert into "agents" ("email", "display_name", "status", "created_at", "updated_at") values ('a@example.com', 'A', 'active', now(), now())`,
    );
    const migrationsBefore = await count("mikro_orm_migrations");
    expect(migrationsBefore).toBeGreaterThan(0);

    const tables = await repository().truncateAll();

    expect(tables).toEqual(expect.arrayContaining(["agents", "suppliers", "return_requests", "evidence_files", "rate_limit_windows"]));
    expect(tables).not.toContain("mikro_orm_migrations");
    expect(await count("suppliers")).toBe(0);
    expect(await count("agents")).toBe(0);
    expect(await count("mikro_orm_migrations")).toBe(migrationsBefore);

    const [{ id }] = await db.query<{ id: number }>(
      `insert into "agents" ("email", "display_name", "status", "created_at", "updated_at") values ('b@example.com', 'B', 'active', now(), now()) returning "id"`,
    );
    expect(Number(id)).toBe(1);
  });

  it("is a no-op on an empty database and can run twice in a row", async () => {
    await repository().truncateAll();
    await expect(repository().truncateAll()).resolves.toBeInstanceOf(Array);
  });

  it("serializes two concurrent resets", async () => {
    await expect(Promise.all([repository().truncateAll(), repository().truncateAll()])).resolves.toHaveLength(2);
  });
});
