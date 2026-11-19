/**
 * Development reset (issue #174): empties every data table, then seeds what `npm run seed:dev` seeds. The whole point is
 * to delete data, so the guard is strict and lives here, next to the operation, not only in the button that triggers it:
 * `NODE_ENV` must be `development` AND the database must be on this machine. A `.env` that points a developer's
 * `next dev` at a shared or staging database therefore cannot be wiped from the admin header.
 * No `server-only` import and no container: the route passes in the collaborators, tests pass in fakes.
 */
import { AppError, NotFoundError } from "@easyrms/core";

import { seedDevData, type DevSeedDeps, type DevSeedResult } from "./dev-seed";

/** The default local database of `npm run db:start` (`packages/db/src/config.ts`); an unset URL means this one. */
const DEFAULT_LOCAL_URL = "postgres://easyrms:easyrms@localhost:5432/easyrms";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** True only for a development process whose database host is a loopback address. Anything unparsable is "no". */
export function isDevResetAvailable(input: { nodeEnv: string | undefined; databaseUrl: string | undefined }): boolean {
  if (input.nodeEnv !== "development") return false;
  try {
    return LOOPBACK_HOSTS.has(new URL(input.databaseUrl?.trim() || DEFAULT_LOCAL_URL).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** `isDevResetAvailable` for the running process. */
export function isDevResetAvailableHere(): boolean {
  return isDevResetAvailable({ nodeEnv: process.env.NODE_ENV, databaseUrl: process.env.EASYRMS_DATABASE_URL });
}

export interface DevResetDeps {
  /** `MikroOrmDevResetRepository` in production wiring. */
  devResetPort: { truncateAll(): Promise<string[]> };
  seed: DevSeedDeps;
  available: boolean;
  logger: { error(message: string, context?: Record<string, unknown>): void };
}

export interface DevResetResult extends DevSeedResult {
  tablesEmptied: number;
}

/** The wipe worked and the seed did not: the database is empty, so nobody can log in until `seed:dev` runs. */
export class DevResetSeedFailedError extends AppError {
  constructor() {
    super("The database was emptied but seeding failed. Run `npm run seed:dev` to restore the dev data.", 500, "dev_reset_seed_failed");
    this.name = "DevResetSeedFailedError";
  }
}

export async function resetDevEnvironment(deps: DevResetDeps): Promise<DevResetResult> {
  // 404, not 403: outside development the route does not exist as far as a caller can tell.
  if (!deps.available) throw new NotFoundError("Not found");
  const tables = await deps.devResetPort.truncateAll();
  try {
    const seeded = await seedDevData({ ...deps.seed, nodeEnv: "development" });
    return { ...seeded, tablesEmptied: tables.length };
  } catch (error) {
    deps.logger.error("dev reset: seeding failed after the wipe", { error: error instanceof Error ? error.message : "unknown" });
    throw new DevResetSeedFailedError();
  }
}

/** What the container hands to the route: the collaborators are already bound. */
export interface DevResetService {
  reset(): Promise<DevResetResult>;
}
