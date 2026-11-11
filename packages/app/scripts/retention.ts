/**
 * Retention and erasure of customer data (threat T-21, brief R16).
 *
 *   npm run retention:run [-- --dry-run]
 *   npm run retention:erase -- --rma <RMA> [--force]
 *
 * `run` anonymizes every request that has been closed for longer than `EASYRMS_RETENTION_DAYS` (default 365): its photos
 * and audit rows are deleted, its e-mail, free text and linked supplier-claim texts are erased. Schedule it with the
 * operator's cron or job runner (nothing is deleted until it runs). `--dry-run` lists what would be erased.
 * `erase` does the same for one request at once (a customer's erasure request); a request that is not closed needs
 * `--force`. It cannot import `src/server/container.ts` (that file imports `server-only`), so it builds a small
 * container from `registerCore` and `registerDb`, like `agent-create.ts`.
 *
 * Exit codes: 0 done, 1 one or more requests failed, 2 bad arguments or configuration, 3 request not found or not closed.
 * Output carries counts and RMA numbers only, never an e-mail address, text or file content.
 */
import { parseArgs } from "node:util";

import { asValue, createContainer, InjectionMode } from "awilix";
import { AppError, ConfigurationError, parseRetentionDays, registerCore, type RetentionService } from "@easyrms/core";
import { getOrm, registerDb } from "@easyrms/db";

const USAGE = "usage: npm run retention:run [-- --dry-run]\n       npm run retention:erase -- --rma <RMA> [--force]";

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    options: {
      "dry-run": { type: "boolean" },
      rma: { type: "string" },
      force: { type: "boolean" },
    },
    allowPositionals: true,
    strict: true,
  });
  const command = positionals[0];
  if ((command !== "run" && command !== "erase") || positionals.length !== 1) {
    console.error(`Unknown command.\n${USAGE}`);
    return 2;
  }
  if (command === "erase" && !values.rma) {
    console.error(`--rma is required.\n${USAGE}`);
    return 2;
  }
  if (command === "run" && (values.rma || values.force)) {
    console.error(`run takes only --dry-run.\n${USAGE}`);
    return 2;
  }
  if (command === "erase" && values["dry-run"]) {
    console.error(`erase takes only --rma and --force.\n${USAGE}`);
    return 2;
  }

  // Parsed before the database is opened: an invalid value deletes nothing.
  let retentionDays: number;
  try {
    retentionDays = parseRetentionDays(process.env.EASYRMS_RETENTION_DAYS);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(error.message);
      return 2;
    }
    throw error;
  }

  const logger = { error: (message: string, context?: Record<string, unknown>) => console.error(message, context) };
  const orm = await getOrm();
  try {
    const container = createContainer({ injectionMode: InjectionMode.PROXY, strict: true });
    container.register({ logger: asValue(logger), retentionDays: asValue(retentionDays) });
    registerCore(container);
    registerDb(container, orm);
    const service = container.createScope().resolve<RetentionService>("retentionService");

    if (command === "run") {
      const result = await service.run({ dryRun: values["dry-run"] === true });
      const verb = result.dryRun ? "would anonymize" : "anonymized";
      console.log(`Retention ${retentionDays} days, cutoff ${result.cutoff.toISOString()}: ${verb} ${result.requests} request(s).`);
      if (result.rmas.length > 0) console.log(`RMA: ${result.rmas.join(", ")}`);
      if (!result.dryRun) {
        console.log(`Deleted ${result.files} file(s) and ${result.auditRows} audit row(s) of those requests, and ${result.orphanFiles} orphan file(s) with ${result.orphanAuditRows} audit row(s).`);
      }
      if (result.failed.length > 0) {
        console.error(`Failed: ${result.failed.map((row) => row.rma).join(", ")}`);
        return 1;
      }
      return 0;
    }

    try {
      const result = await service.eraseOne(values.rma ?? "", { force: values.force === true });
      console.log(result.alreadyErased ? `${result.rma} was already erased.` : `Erased ${result.rma}: ${result.files} file(s) and ${result.auditRows} audit row(s) deleted.`);
      return 0;
    } catch (error) {
      if (error instanceof AppError) {
        console.error(error.message);
        return 3;
      }
      throw error;
    }
  } finally {
    await orm.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : "Unexpected failure");
    process.exit(1);
  },
);
