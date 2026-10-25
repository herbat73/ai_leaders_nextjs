import { randomBytes } from "node:crypto";

import { MikroORM, type EntityManager } from "@mikro-orm/postgresql";

import { createOrmConfig, DEFAULT_DATABASE_URL } from "../config";
import { Migration20261013164552 } from "../migrations/Migration20261013164552";
import { Migration20261023183126 } from "../migrations/Migration20261023183126";
import { Migration20261023202921 } from "../migrations/Migration20261023202921";
import { Migration20261024192605 } from "../migrations/Migration20261024192605";
import { Migration20261025180000 } from "../migrations/Migration20261025180000";

export const MIGRATIONS = {
  initial: "Migration20261013164552",
  agentDecision: "Migration20261023183126",
  customerPortal: "Migration20261023202921",
  agentLogin: "Migration20261024192605",
  complaints: "Migration20261025180000",
} as const;

const migrationsList = [
  { name: MIGRATIONS.initial, class: Migration20261013164552 },
  { name: MIGRATIONS.agentDecision, class: Migration20261023183126 },
  { name: MIGRATIONS.customerPortal, class: Migration20261023202921 },
  { name: MIGRATIONS.agentLogin, class: Migration20261024192605 },
  { name: MIGRATIONS.complaints, class: Migration20261025180000 },
];

export interface TestDatabase {
  orm: MikroORM;
  schema: string;
  /** A fresh fork, i.e. its own identity map and its own connection use. */
  fork(): EntityManager;
  /** Runs migrations up to and including `to`, or all pending ones. */
  migrateUp(to?: string): Promise<void>;
  migrateDown(to?: string): Promise<void>;
  /** Raw SQL against the throwaway schema (seeding and assertions). */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

function describeTarget(url: string): string {
  const parsed = new URL(url);
  return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
}

/**
 * A throwaway schema on the local Postgres (`npm run db:start`): the schema is selected through `search_path`, so the
 * unqualified table and sequence names in the migrations resolve inside it, and it is dropped on `close()`.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const baseUrl = process.env.EASYRMS_DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const schema = `test_${randomBytes(6).toString("hex")}`;

  const admin = await MikroORM.init({ ...createOrmConfig(), clientUrl: baseUrl });
  try {
    await admin.em.getConnection().execute(`create schema "${schema}"`);
  } catch (error) {
    await admin.close().catch(() => undefined);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot reach Postgres at ${describeTarget(baseUrl)} (${reason}). ` +
        "Start it with `npm run db:start` (or set EASYRMS_DATABASE_URL), then run `npm run test:db` again.",
    );
  }
  await admin.close();

  const config = createOrmConfig();
  const orm = await MikroORM.init({
    ...config,
    clientUrl: baseUrl,
    // Merged into the `pg` pool options: every connection starts with the throwaway schema on its search_path.
    driverOptions: { options: `-c search_path=${schema}` },
    schema,
    // `snapshot: false`: the migrator would otherwise rewrite the committed snapshot with this throwaway schema.
    migrations: { ...config.migrations, migrationsList, snapshot: false },
  });

  return {
    orm,
    schema,
    fork: () => orm.em.fork(),
    migrateUp: async (to) => {
      await orm.migrator.up(to ? { to } : undefined);
    },
    migrateDown: async (to) => {
      await orm.migrator.down(to ? { to } : undefined);
    },
    query: async <T>(sql: string, params: unknown[] = []) =>
      (await orm.em.getConnection().execute(sql, params)) as T[],
    close: async () => {
      await orm.em.getConnection().execute(`drop schema if exists "${schema}" cascade`);
      await orm.close();
    },
  };
}

/** Inserts a pre-migration (legacy) return request; only valid before `MIGRATIONS.agentDecision` ran. */
export async function insertLegacyRequest(
  db: TestDatabase,
  row: { status: string; createdAt: string; order?: string },
): Promise<void> {
  await db.query(
    `insert into "return_requests" ("order_number", "customer_email", "reason", "status", "created_at", "updated_at") values (?, ?, ?, ?, ?, ?)`,
    [row.order ?? "ORD", "customer@example.com", "reason", row.status, row.createdAt, row.createdAt],
  );
}
