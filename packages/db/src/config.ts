import { defineConfig } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";

import { entities } from "./entities";

export const DEFAULT_DATABASE_URL = "postgres://easyrms:easyrms@localhost:5433/easyrms";

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createOrmConfig() {
  return defineConfig({
    clientUrl: process.env.EASYRMS_DATABASE_URL ?? DEFAULT_DATABASE_URL,
    entities,
    extensions: [Migrator],
    // One pool per process; tune with EASYRMS_DB_POOL_MIN / EASYRMS_DB_POOL_MAX.
    pool: {
      min: intFromEnv("EASYRMS_DB_POOL_MIN", 2),
      max: intFromEnv("EASYRMS_DB_POOL_MAX", 10),
    },
    migrations: {
      path: "./src/migrations",
      glob: "!(*.d).{js,ts}",
      transactional: true,
    },
    debug: process.env.EASYRMS_DB_DEBUG === "true",
  });
}
