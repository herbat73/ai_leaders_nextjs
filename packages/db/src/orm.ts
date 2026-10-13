import { MikroORM } from "@mikro-orm/postgresql";

import { createOrmConfig } from "./config";

const globalForOrm = globalThis as unknown as { __easyrmsOrm?: Promise<MikroORM> };

/**
 * Returns the process-wide MikroORM instance (and thus the one connection pool).
 * Cached on `globalThis` so Next.js dev reloads do not leak pools.
 */
export function getOrm(): Promise<MikroORM> {
  globalForOrm.__easyrmsOrm ??= MikroORM.init(createOrmConfig()).catch((error) => {
    globalForOrm.__easyrmsOrm = undefined;
    throw error;
  });
  return globalForOrm.__easyrmsOrm;
}
