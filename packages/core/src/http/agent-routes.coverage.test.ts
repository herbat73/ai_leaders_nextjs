import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { isAgentProtectedPath } from "./agent-routes";

const APP_DIR = fileURLToPath(new URL("../../../app/src/app", import.meta.url));

/**
 * Every URL the app serves that must stay reachable without an agent session. A new page or route that is not listed
 * here is expected to be protected, so a forgotten entry fails this test instead of silently shipping open (or closed).
 */
const PUBLIC_ROUTES = new Set([
  "/",
  "/returns",
  "/returns/new",
  "/returns/abc",
  "/admin/login",
  "/admin/invite/abc",
  "/api/health",
  "/api/returns",
  "/api/returns/lookup",
  "/api/returns/quote",
  "/api/returns/session",
  "/api/agents/login",
  "/api/agents/invite/accept",
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
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
  const urls = walk(APP_DIR)
    .map(toUrl)
    .filter((url): url is string => url !== null)
    .sort();

  it("finds the app's routes", () => {
    expect(urls.length).toBeGreaterThan(15);
    expect(urls).toContain("/admin/returns/5");
    expect(urls).toContain("/api/returns/5");
  });

  it.each(urls)("%s is protected exactly when it is not in the public list", (url) => {
    expect(isAgentProtectedPath(url)).toBe(!PUBLIC_ROUTES.has(url));
  });

  it("has no stale public entries for routes that no longer exist", () => {
    for (const url of PUBLIC_ROUTES) expect(urls).toContain(url);
  });
});
