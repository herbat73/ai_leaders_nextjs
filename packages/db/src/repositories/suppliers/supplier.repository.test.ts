import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConflictError } from "@easyrms/core";

import { createTestDatabase, MIGRATIONS, type TestDatabase } from "../../test-support/postgres";
import { MikroOrmSupplierRepository } from "./supplier.repository";

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.migrateUp();
});

afterAll(async () => {
  await db?.close();
});

const repository = () => new MikroOrmSupplierRepository({ em: db.fork() });

describe("MikroOrmSupplierRepository", () => {
  it("creates, reads back and lists active suppliers first, by name", async () => {
    const zeta = await repository().create({ name: "Zeta Sp. z o.o.", email: "claims@zeta.example", guidelines: "Wideo wymagane" });
    const alfa = await repository().create({ name: "Alfa", email: "a@alfa.example", guidelines: null });
    await repository().update(zeta.id, { active: false });

    expect(zeta).toMatchObject({ active: true, guidelines: "Wideo wymagane" });
    expect(await repository().findById(alfa.id)).toMatchObject({ name: "Alfa", guidelines: null });
    const names = (await repository().list()).map((s) => [s.name, s.active]);
    expect(names).toEqual([["Alfa", true], ["Zeta Sp. z o.o.", false]]);
  });

  it("refuses a duplicate name case-insensitively with a conflict", async () => {
    await repository().create({ name: "Beta", email: "b@beta.example", guidelines: null });
    await expect(repository().create({ name: "BETA", email: "x@beta.example", guidelines: null })).rejects.toBeInstanceOf(ConflictError);
    const other = await repository().create({ name: "Gamma", email: "g@gamma.example", guidelines: null });
    await expect(repository().update(other.id, { name: "beta" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("updates only the given fields and clears guidelines with null", async () => {
    const created = await repository().create({ name: "Delta", email: "d@delta.example", guidelines: "x" });
    const updated = await repository().update(created.id, { guidelines: null });
    expect(updated).toMatchObject({ name: "Delta", email: "d@delta.example", guidelines: null });
  });

  it("returns null for an unknown supplier", async () => {
    expect(await repository().findById(9999)).toBeNull();
    expect(await repository().update(9999, { active: false })).toBeNull();
  });
});

describe("Migration20261025190000", () => {
  it("rolls back while empty and refuses once a supplier exists", async () => {
    const database = await createTestDatabase();
    try {
      await database.migrateUp();
      await database.migrateDown(MIGRATIONS.complaints);
      const gone = await database.query(`select to_regclass('suppliers') as "t"`);
      expect(gone).toEqual([{ t: null }]);

      await database.migrateUp();
      await database.query(`insert into "suppliers" ("name", "email", "created_at", "updated_at") values ('A', 'a@x.pl', now(), now())`);
      await expect(database.migrateDown(MIGRATIONS.complaints)).rejects.toThrow(/Refusing to roll back/);
    } finally {
      await database.close();
    }
  });
});
