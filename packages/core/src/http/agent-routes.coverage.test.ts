import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { isAgentProtectedPath } from "./agent-routes";

const APP_DIR = fileURLToPath(new URL("../../../app/src/app", import.meta.url));

/**
 * Every `METHOD url` the app serves that must stay reachable without an agent session (pages are `GET`). A new page,
 * route or method that is not listed here is expected to be protected, so a forgotten entry fails this test instead of
 * silently shipping open (or closed), and a public `POST` cannot hide a public `GET` on the same path.
 */
const PUBLIC_ROUTES = new Set([
  "GET /",
  "GET /returns",
  "GET /returns/new",
  "GET /returns/complaint/new",
  "GET /returns/transport/new",
  "GET /returns/missing/new",
  "GET /returns/abc",
  "GET /admin/login",
  "GET /admin/invite/abc",
  "GET /api/health",
  "POST /api/returns",
  "POST /api/returns/lookup",
  "POST /api/returns/quote",
  "DELETE /api/returns/session",
  "POST /api/agents/login",
  "POST /api/agents/invite/accept",
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const HTTP_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

/** Methods a route file exports (`export const GET`, `export async function POST`, `export const { PATCH, GET }`). */
function exportedMethods(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return HTTP_METHODS.filter((method) =>
    new RegExp(`export\\s+(?:const|async\\s+function|function)\\s+${method}\\b|export\\s+const\\s*\\{[^}]*\\b${method}\\b[^}]*\\}`).test(source),
  );
}

/** `admin/returns/[id]/page.tsx` becomes `/admin/returns/5`; private (`_x`) folders and non-routes are skipped. */
function toUrl(file: string): string | null {
  const parts = relative(APP_DIR, file).split(sep);
  const leaf = parts.pop();
  if (leaf !== "page.tsx" && leaf !== "route.ts") return null;
  if (parts.some((part) => part.startsWith("_"))) return null;
  const segments = parts.filter((part) => !/^\(.*\)$/.test(part)).map((part) => (part === "[id]" ? "5" : /^\[.+\]$/.test(part) ? "abc" : part));
  return `/${segments.join("/")}`;
}

describe("agent route protection covers every page and route in the app", () => {
  const entries = walk(APP_DIR)
    .flatMap((file) => {
      const url = toUrl(file);
      if (url === null) return [];
      return (file.endsWith("route.ts") ? exportedMethods(file) : ["GET"]).map((method) => `${method} ${url}`);
    })
    .sort();
  const urls = entries.map((entry) => entry.slice(entry.indexOf(" ") + 1));

  it("finds the app's routes", () => {
    expect(urls.length).toBeGreaterThan(15);
    expect(urls).toContain("/admin/returns/5");
    expect(urls).toContain("/api/returns/5");
    expect(entries).toContain("GET /api/returns");
    expect(entries).toContain("POST /api/returns");
  });

  it.each(entries)("%s is protected exactly when it is not in the public list", (entry) => {
    const [method, url] = entry.split(" ") as [string, string];
    expect(isAgentProtectedPath(url, method)).toBe(!PUBLIC_ROUTES.has(entry));
  });

  it("has no stale public entries for routes that no longer exist", () => {
    for (const entry of PUBLIC_ROUTES) expect(entries).toContain(entry);
  });
});

/**
 * The permission each protected API route file declares, one entry per exported handler (sorted). Adding an agent route
 * or changing who may call one means editing this table, which makes the decision visible in review. `MANAGE_RULES` is
 * manager-only; `any-agent` is every signed-in agent (the service enforces any finer rule, e.g. the refund limit on
 * `PATCH /api/returns/[id]`). Routes without an agent session (the public list above) are not in the table.
 */
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  "agents/route.ts": ["MANAGE_RULES", "MANAGE_RULES"],
  "agents/[id]/route.ts": ["MANAGE_RULES"],
  "agents/logout/route.ts": ["any-agent"],
  "discovery/case-sample/route.ts": ["any-agent"],
  "returns/route.ts": ["any-agent"],
  "returns/[id]/route.ts": ["any-agent"],
  "rules/route.ts": ["MANAGE_RULES"],
  "rules/simulate/route.ts": ["MANAGE_RULES"],
  "suppliers/route.ts": ["MANAGE_RULES", "any-agent"],
  "suppliers/[id]/route.ts": ["MANAGE_RULES"],
  "supplier-claims/route.ts": ["any-agent", "any-agent"],
  "supplier-claims/[id]/route.ts": ["any-agent"],
  "supplier-claims/[id]/send/route.ts": ["any-agent"],
};

describe("every agent API route declares its permission", () => {
  const API_DIR = join(APP_DIR, "api");
  const files = walk(API_DIR).filter((file) => file.endsWith("route.ts"));
  const agentFiles = files.filter((file) => readFileSync(file, "utf8").includes("authenticate:"));
  const keyOf = (file: string): string => relative(API_DIR, file).split(sep).join("/");
  const declared = (file: string): string[] =>
    [...readFileSync(file, "utf8").matchAll(/\bpermission:\s*(?:"(MANAGE_RULES)"|(ANY_AGENT))/g)].map((m) => m[1] ?? "any-agent").sort();
  const handlers = (file: string): number => (readFileSync(file, "utf8").match(/\bauthenticate:/g) ?? []).length;

  it("finds the agent routes", () => {
    expect(agentFiles.length).toBeGreaterThan(8);
  });

  it.each(agentFiles.map(keyOf).sort())("%s declares a permission for each of its handlers", (key) => {
    const file = join(API_DIR, key);
    expect(declared(file), "a handler with `authenticate` but no `permission:` (use ANY_AGENT only on purpose)").toHaveLength(handlers(file));
  });

  it.each(agentFiles.map(keyOf).sort())("%s matches the permission table", (key) => {
    expect(ROUTE_PERMISSIONS[key], `add ${key} to ROUTE_PERMISSIONS`).toBeDefined();
    expect(declared(join(API_DIR, key))).toEqual([...(ROUTE_PERMISSIONS[key] ?? [])].sort());
  });

  it("has no table entry for a route that no longer exists", () => {
    expect(Object.keys(ROUTE_PERMISSIONS).sort()).toEqual(agentFiles.map(keyOf).sort());
  });

  it("keeps the permission check out of handler bodies", () => {
    for (const file of agentFiles) expect(readFileSync(file, "utf8"), keyOf(file)).not.toMatch(/requirePermission\(/);
  });
});
