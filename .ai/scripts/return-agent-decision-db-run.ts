/**
 * End-to-end check for the return agent decision spec (Phase 1, step 3): migrates a seeded legacy database and drives
 * the real routes of the built app. Run from the repo root with the local Postgres up (`npm run db:start`):
 *
 *   npx tsx .ai/scripts/return-agent-decision-db-run.ts --log .ai/runs/YYYY-MM-DD-return-agent-decision-db-run.md
 *
 * It creates and drops a scratch database (`easyrms_e2e`), builds the app, starts it on a free port and never touches
 * the `easyrms` development database. Exit code is 1 when any check fails.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { formatRma } from "@easyrms/core";

const ADMIN_URL = process.env.EASYRMS_E2E_ADMIN_URL ?? "postgres://postgres@localhost:5433/postgres";
const DB_NAME = "easyrms_e2e";
const DB_URL = `postgres://easyrms:easyrms@localhost:5433/${DB_NAME}`;
const PORT = Number(process.env.EASYRMS_E2E_PORT ?? 3111);
const BASE = `http://localhost:${PORT}`;
const SNAPSHOT = `packages/db/src/migrations/.snapshot-${DB_NAME}.json`;
const INITIAL_MIGRATION = "Migration20261013164552";
const GENERATED_ROWS = 100_000;
const NOTE_30 = "Item was used and returned late.";

const logPath = process.argv.includes("--log") ? process.argv[process.argv.indexOf("--log") + 1] : undefined;
const lines: string[] = [];
let failures = 0;

function log(line = ""): void {
  lines.push(line);
  console.log(line);
}

// Strips ANSI colour codes from tool output.
const stripAnsi = (text: string): string => text.replace(/\u001b\[[0-9;]*m/g, "");

function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failures += 1;
  log(`- ${ok ? "✅" : "❌"} ${name}${detail ? ` — ${stripAnsi(detail)}` : ""}`);
}

function psql(url: string, sql: string): string {
  const run = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-qtA", "-F", "|", "-c", sql], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) throw new Error(`psql failed: ${run.stderr || run.error}`);
  return run.stdout.trim();
}

function npm(args: string[], env: Record<string, string> = {}): { status: number; output: string } {
  const run = spawnSync("npm", args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  return { status: run.status ?? 1, output: `${run.stdout}${run.stderr}` };
}

interface Row {
  id: number;
  order: string;
  rma: string;
  status: string;
  createdAt: Date;
}

function readRows(): Row[] {
  const out = psql(
    DB_URL,
    `select "id", "order_number", "rma", "status", to_char("created_at" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from "return_requests" order by "id"`,
  );
  return out.split("\n").map((line) => {
    const [id, order, rma, status, created] = line.split("|");
    return { id: Number(id), order, rma, status, createdAt: new Date(created) };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- response bodies are inspected loosely in a script
type LooseJson = any;

async function api(path: string, init?: RequestInit): Promise<{ status: number; body: LooseJson }> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-requested-with": "easyrms" },
  });
  return { status: response.status, body: await response.json() };
}

const patch = (id: number, body: object) => api(`/api/returns/${id}`, { method: "PATCH", body: JSON.stringify(body) });
const events = (id: number) => Number(psql(DB_URL, `select count(*) from "return_request_events" where "return_request_id" = ${id}`));
const noteOf = (id: number) => psql(DB_URL, `select coalesce("decision_note", '<null>') from "return_requests" where "id" = ${id}`);

async function waitForServer(server: ChildProcess): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) throw new Error("The app exited before it became ready");
    const ready = await fetch(`${BASE}/api/health`).then((r) => r.ok, () => false);
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The app did not become ready in 60 s");
}

async function main(): Promise<void> {
  const started = new Date().toISOString();
  log(`# Return agent decision: scripted Postgres run`);
  log();
  log(`Started ${started}. Scratch database \`${DB_NAME}\`, app on port ${PORT}.`);
  log();

  psql(ADMIN_URL, `drop database if exists ${DB_NAME} with (force)`);
  psql(ADMIN_URL, `create database ${DB_NAME} owner easyrms`);

  log(`## Migration`);
  const initial = npm(["run", "db:migrate", "-w", "@easyrms/db", "--", "--to", INITIAL_MIGRATION], { EASYRMS_DATABASE_URL: DB_URL });
  check("initial migration applied (legacy schema)", initial.status === 0, initial.output.split("\n").find((l) => l.includes("Applied")) ?? "");

  const legacy: [string, string, string][] = [
    ["A", "requested", "2026-03-01T10:00:00Z"],
    ["B", "refunded", "2026-03-02T10:00:00Z"],
    ["C", "approved", "2026-03-03T10:00:00Z"],
    ["D", "rejected", "2026-03-04T10:00:00Z"],
    ["E", "received", "2026-03-05T10:00:00Z"],
    ["F", "weird", "2026-03-06T10:00:00Z"],
    ["G", "requested", "2026-12-31T23:30:00Z"],
    ["H", "requested", "2026-12-31T23:30:00Z"],
  ];
  psql(
    DB_URL,
    `insert into "return_requests" ("order_number","customer_email","reason","status","created_at","updated_at") select 'GEN', 'g@example.com', 'r', 'requested', timestamptz '2025-01-01 00:00:00+00' + (n || ' seconds')::interval, now() from generate_series(1, ${GENERATED_ROWS}) as n`,
  );
  psql(
    DB_URL,
    `insert into "return_requests" ("order_number","customer_email","reason","status","created_at","updated_at") values ${legacy
      .map(([order, status, at]) => `('${order}','${order.toLowerCase()}@example.com','legacy','${status}','${at}','${at}')`)
      .join(",")}`,
  );
  const total = GENERATED_ROWS + legacy.length;
  log(`Seeded ${total} legacy rows (${GENERATED_ROWS} generated, ${legacy.length} named: every legacy status, a corrupt one, two rows tied at 31 Dec 23:30 UTC).`);

  const up = npm(["run", "db:migrate", "-w", "@easyrms/db"], { EASYRMS_DATABASE_URL: DB_URL });
  check("agent decision migration applied", up.status === 0 && up.output.includes("Migration20261023183126"));

  const rows = readRows();
  const byOrder = (order: string): Row => rows.find((row) => row.order === order) as Row;
  check("status mapping", ["A", "B", "C", "D", "E", "F"].map((o) => byOrder(o).status).join(",") === "submitted,resolved,approved,rejected,received,weird", ["A", "B", "C", "D", "E", "F"].map((o) => byOrder(o).status).join(","));

  const ordered = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
  const mismatches = ordered.filter((row, index) => row.rma !== formatRma(index + 1, row.createdAt));
  check(`every backfilled RMA equals formatRma(seq, created_at) in created_at, id order (${rows.length} rows)`, mismatches.length === 0, mismatches[0] ? `first mismatch id ${mismatches[0].id}: ${mismatches[0].rma}` : "");
  check("tie broken by id, year taken in Europe/Warsaw (31 Dec 23:30 UTC is 2027)", byOrder("G").rma === `RMA-2027-${total - 1}` && byOrder("H").rma === `RMA-2027-${total}`, `${byOrder("G").rma}, ${byOrder("H").rma}`);
  check("sequence past 99999 is not truncated (no lpad)", byOrder("H").rma.length === "RMA-2027-100008".length, byOrder("H").rma);
  check("one synthesized submitted event per row", Number(psql(DB_URL, `select count(*) from "return_request_events" where "type" = 'submitted' and "actor" = 'system'`)) === total);

  log();
  log(`## App routes`);
  const build = npm(["run", "build"], { NODE_ENV: "production", EASYRMS_DATABASE_URL: DB_URL });
  check("production build", build.status === 0);
  const server = spawn("npm", ["run", "start", "-w", "@easyrms/app", "--", "-p", String(PORT)], {
    env: { ...process.env, NODE_ENV: "production", EASYRMS_DATABASE_URL: DB_URL },
    stdio: "ignore",
    detached: true,
    shell: process.platform === "win32",
  });
  try {
    await waitForServer(server);

    const received = await api("/api/returns?status=received");
    check("GET ?status=received lists one row with its shape", received.status === 200 && received.body.data.length === 1 && received.body.data[0].rma === byOrder("E").rma && received.body.data[0].allowedTransitions.join() === "resolved" && "dueAt" in received.body.data[0] && "hasDecisionNote" in received.body.data[0]);
    const unknown = await api("/api/returns?status=unknown");
    check("GET ?status=unknown lists the corrupt row with no actions", unknown.status === 200 && unknown.body.data.length === 1 && unknown.body.data[0].status === "unknown" && unknown.body.data[0].allowedTransitions.length === 0);
    const bogus = await api("/api/returns?status=bogus");
    check("GET ?status=bogus is 400", bogus.status === 400 && bogus.body.error.code === "validation_error");

    const a = byOrder("A").id;
    const approved = await patch(a, { status: "approved" });
    check("PATCH submitted → approved is 200", approved.status === 200 && approved.body.data.status === "approved" && approved.body.data.allowedTransitions.join() === "in_transit");
    check("the move wrote one event next to the creation event", events(a) === 2);
    const backwards = await patch(a, { status: "rejected", decisionNote: NOTE_30 });
    check("PATCH approved → rejected is 409 carrying the stored status", backwards.status === 409 && backwards.body.error.fieldErrors.status === "approved");
    check("the refused move wrote no event", events(a) === 2);

    const g = byOrder("G").id;
    const short = await patch(g, { status: "rejected", decisionNote: "x".repeat(29) });
    check("reject with 29 characters is 400 under decisionNote", short.status === 400 && "decisionNote" in short.body.error.fieldErrors);
    const long = await patch(g, { status: "rejected", decisionNote: "x".repeat(30) });
    check("reject with 30 characters is 200", long.status === 200 && long.body.data.hasDecisionNote === true);

    const h = byOrder("H").id;
    const noteOnShipping = await patch(h, { status: "in_transit", decisionNote: NOTE_30 });
    check("a note with any status but approved/rejected is 400", noteOnShipping.status === 400 && "decisionNote" in noteOnShipping.body.error.fieldErrors);
    await patch(h, { status: "approved", decisionNote: NOTE_30 });
    await patch(h, { status: "in_transit" });
    await patch(h, { status: "received" });
    check("later moves leave the decision note unchanged (P6)", noteOf(h) === NOTE_30, noteOf(h));

    const corrupt = await patch(byOrder("F").id, { status: "approved" });
    check("PATCH on an unknown-status row is 409", corrupt.status === 409 && corrupt.body.error.fieldErrors.status === "unknown");
    const missing = await patch(2_000_000_000, { status: "approved" });
    check("PATCH on an unknown id is 404", missing.status === 404);

    const raced = rows.find((row) => row.order === "GEN" && row.status === "submitted") as Row;
    const [one, two] = await Promise.all([patch(raced.id, { status: "approved" }), patch(raced.id, { status: "rejected", decisionNote: NOTE_30 })]);
    const winner = [one, two].find((response) => response.status === 200);
    const loser = [one, two].find((response) => response.status === 409);
    check("two concurrent moves: one 200, one 409", Boolean(winner && loser), `${one.status}/${two.status}`);
    check("the loser's 409 carries the winner's status", Boolean(winner && loser && loser.body.error.fieldErrors.status === winner.body.data.status));
    check("exactly one event for the race (plus creation)", events(raced.id) === 2, `events=${events(raced.id)}`);

    const created = await api("/api/returns", { method: "POST", body: JSON.stringify({ orderNumber: "NEW-1", customerEmail: "new@example.com", reason: "Legacy form" }) });
    const year = new Date().getUTCFullYear();
    check("POST creates a submitted request with the next RMA", created.status === 201 && created.body.data.status === "submitted" && created.body.data.rma === `RMA-${year}-${total + 1}`, created.body.data?.rma);
    log("- ➖ the portal's transaction-scoped create is not checked yet (its PR A has not landed)");
  } finally {
    if (server.pid) {
      try {
        process.kill(-server.pid);
      } catch (error) {
        log(`(app already stopped: ${(error as Error).message})`);
      }
    }
  }

  log();
  log(`## Rollback`);
  const down = npm(["run", "db:migration:down", "-w", "@easyrms/db"], { EASYRMS_DATABASE_URL: DB_URL });
  check("down refuses after agent use", down.status !== 0 && down.output.includes("forward-only"));
  check("down changed nothing", psql(DB_URL, `select count(*) from information_schema.columns where table_name = 'return_requests' and column_name = 'rma'`) === "1");

  log();
  log(failures === 0 ? `**Result: all checks passed.** Finished ${new Date().toISOString()}.` : `**Result: ${failures} check(s) failed.**`);
}

main()
  .catch((error: unknown) => {
    failures += 1;
    log(`❌ run aborted: ${error instanceof Error ? error.message : String(error)}`);
  })
  .finally(() => {
    try {
      psql(ADMIN_URL, `drop database if exists ${DB_NAME} with (force)`);
    } catch (error) {
      log(`(scratch database not dropped: ${(error as Error).message})`);
    }
    if (existsSync(SNAPSHOT)) rmSync(SNAPSHOT);
    if (logPath) writeFileSync(logPath, `${lines.join("\n")}\n`);
    process.exit(failures === 0 ? 0 : 1);
  });
