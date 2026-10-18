#!/usr/bin/env node
// One-command local setup (`npm run setup`): preflight, install, database, migrations.
// Idempotent: every step checks whether it is already done and is skipped when so. See
// .ai/specs/2026-10-14-idempotent-setup-installer.md.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

// Next.js 16 requires Node >= 20.9 (its `engines` field); checked before node_modules exists.
const MIN_NODE = [20, 9];
// Keep in sync with DEFAULT_DATABASE_URL in packages/db/src/config.ts.
const DEFAULT_DATABASE_URL = "postgres://easyrms:easyrms@localhost:5433/easyrms";
const databaseUrl = process.env.EASYRMS_DATABASE_URL ?? DEFAULT_DATABASE_URL;
const managesLocalDatabase = databaseUrl === DEFAULT_DATABASE_URL;

class SetupError extends Error {}

/**
 * Runs a shell command line from the repo root. Output is shown unless `capture` is set. Goes through the shell
 * because on Windows `npm` is `npm.cmd`, which spawnSync cannot start directly (EINVAL/ENOENT). Command lines
 * are fixed strings in this file, never user input.
 */
function run(commandLine, { capture = false } = {}) {
  const result = spawnSync(commandLine, { cwd: root, encoding: "utf8", shell: true, stdio: capture ? "pipe" : "inherit" });
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function runOrFail(commandLine, hint) {
  if (!run(commandLine).ok) throw new SetupError(`\`${commandLine}\` failed. ${hint}`);
}

function endpoint(url) {
  const { hostname, port } = new URL(url);
  // URL keeps the brackets of an IPv6 host ("[::1]"); net.connect wants it bare.
  return { host: hostname.replace(/^\[|\]$/g, ""), port: Number(port) || 5432 };
}

function isReachable({ host, port }) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 1500 });
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("timeout", () => (socket.destroy(), resolve(false)));
    socket.once("error", () => resolve(false));
  });
}

/** Same lookup as scripts/db.sh: $PGBIN, else the newest /usr/lib/postgresql/*\/bin, else pg_ctl on PATH. */
function postgresBinariesAvailable() {
  if (process.env.PGBIN) return existsSync(`${process.env.PGBIN}/pg_ctl`);
  const versions = existsSync("/usr/lib/postgresql") ? readdirSync("/usr/lib/postgresql") : [];
  if (versions.some((version) => existsSync(`/usr/lib/postgresql/${version}/bin/pg_ctl`))) return true;
  return run(process.platform === "win32" ? "where pg_ctl" : "command -v pg_ctl", { capture: true }).ok;
}

/** Docker with the compose plugin and a running daemon (`docker info` fails when the daemon is down). */
function dockerAvailable() {
  return run("docker compose version", { capture: true }).ok && run("docker info", { capture: true }).ok;
}

function dependenciesUpToDate() {
  const marker = path.join(root, "node_modules/.package-lock.json");
  const lockfile = path.join(root, "package-lock.json");
  return existsSync(marker) && statSync(marker).mtimeMs >= statSync(lockfile).mtimeMs;
}

// Each step returns a skip reason when nothing needed doing, or undefined after doing the work.
const steps = [
  {
    name: "preflight",
    async run() {
      const [major, minor] = process.versions.node.split(".").map(Number);
      if (major < MIN_NODE[0] || (major === MIN_NODE[0] && minor < MIN_NODE[1])) {
        throw new SetupError(`Node ${MIN_NODE.join(".")}+ is required, found ${process.versions.node}.`);
      }
    },
  },
  {
    name: "install dependencies",
    async run() {
      if (dependenciesUpToDate()) return "node_modules is up to date with package-lock.json";
      runOrFail("npm install", "Fix the error above, or run `npm install` manually.");
    },
  },
  {
    name: "start database",
    async run() {
      const target = endpoint(databaseUrl);
      if (await isReachable(target)) return `already reachable on ${target.host}:${target.port}`;
      if (!managesLocalDatabase) {
        throw new SetupError(
          `EASYRMS_DATABASE_URL points at ${target.host}:${target.port}, which is not reachable. ` +
            "setup only starts the default local database; start yours and re-run.",
        );
      }
      if (postgresBinariesAvailable()) {
        runOrFail("npm run db:start", "Try `npm run db:start` manually and check .data/postgres.log.");
        return;
      }
      if (dockerAvailable()) {
        // --wait blocks until the compose healthcheck (pg_isready) passes.
        runOrFail("docker compose up -d --wait postgres", "Try `docker compose up -d postgres` manually and check `docker compose logs postgres`.");
        return;
      }
      throw new SetupError(
        "Neither PostgreSQL binaries nor a running Docker were found. Install PostgreSQL (or set PGBIN to its bin " +
          "directory, see scripts/db.sh), or start Docker Desktop so setup can use docker-compose.yml.",
      );
    },
  },
  {
    name: "run migrations",
    async run() {
      const pending = run("npm run db:migration:pending -w @easyrms/db", { capture: true });
      if (pending.ok && /no pending migrations/i.test(pending.output)) return "no pending migrations";
      runOrFail("npm run db:migrate", "Check the database connection and re-run, or try `npm run db:migrate` manually.");
    },
  },
];

for (const step of steps) {
  try {
    const skipped = await step.run();
    console.log(skipped ? `↷ ${step.name} — skipped (${skipped})` : `✔ ${step.name} — done`);
  } catch (error) {
    if (!(error instanceof SetupError)) throw error;
    console.error(`✘ ${step.name} — ${error.message}`);
    process.exit(1);
  }
}

console.log("\nNext: npm run dev → http://localhost:3000");
