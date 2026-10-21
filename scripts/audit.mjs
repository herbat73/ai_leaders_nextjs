#!/usr/bin/env node
// Validation-gate wrapper around `npm audit`: fails on any high+ vulnerability except advisories listed in
// audit-allowlist.json, each of which needs a written reason and an expiry date.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SEVERITY_RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const THRESHOLD = SEVERITY_RANK.high;

const root = new URL("..", import.meta.url);
const { advisories } = JSON.parse(readFileSync(new URL("audit-allowlist.json", root), "utf8"));

const today = new Date().toISOString().slice(0, 10);
const expired = advisories.filter((entry) => entry.expires < today);
for (const entry of expired) console.error(`Allowlist entry ${entry.id} (${entry.package}) expired on ${entry.expires}: re-evaluate it.`);

const active = new Set(advisories.filter((entry) => entry.expires >= today).map((entry) => entry.id));

// Run npm's own CLI through Node: on Windows `npm` is `npm.cmd`, which spawnSync cannot start without a shell.
// `npm_execpath` is set by `npm run`; the shell fallback covers invoking this script with plain `node`.
const npmCli = process.env.npm_execpath;
const run = npmCli
  ? spawnSync(process.execPath, [npmCli, "audit", "--json"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  : spawnSync("npm audit --json", { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: true });
if (!run.stdout) {
  console.error(`npm audit did not run: ${run.error?.message ?? run.stderr ?? "no output"}`);
  process.exit(1);
}
const report = JSON.parse(run.stdout);
if (report.error) {
  console.error(`npm audit failed: ${report.error.summary ?? JSON.stringify(report.error)}`);
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
const memo = new Map();

/** Advisory ids that still count against `name`, following transitive `via` chains. */
function blockingAdvisories(name) {
  if (memo.has(name)) return memo.get(name);
  memo.set(name, []); // cycle guard
  const vulnerability = vulnerabilities[name];
  const blocking = [];
  if (vulnerability && SEVERITY_RANK[vulnerability.severity] >= THRESHOLD) {
    for (const via of vulnerability.via) {
      if (typeof via === "string") blocking.push(...blockingAdvisories(via));
      else {
        const id = via.url?.split("/").pop() ?? String(via.source);
        if (!active.has(id) && SEVERITY_RANK[via.severity] >= THRESHOLD) blocking.push(`${via.name}: ${id} (${via.title})`);
      }
    }
  }
  memo.set(name, blocking);
  return blocking;
}

const blocked = [...new Set(Object.keys(vulnerabilities).flatMap(blockingAdvisories))];
const allowed = Object.values(vulnerabilities).filter(
  (v) => SEVERITY_RANK[v.severity] >= THRESHOLD && blockingAdvisories(v.name).length === 0,
);

if (allowed.length > 0) console.log(`Allowlisted (see audit-allowlist.json): ${allowed.map((v) => v.name).join(", ")}`);
if (blocked.length > 0 || expired.length > 0) {
  for (const line of blocked) console.error(`Blocking vulnerability — ${line}`);
  process.exit(1);
}
console.log("npm audit: no blocking high/critical vulnerabilities.");
