import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The invite token is part of the path of `/admin/invite/<token>`, so the page must send `Referrer-Policy: no-referrer`
 * (threat T-08). `app` has no test runner, so this reads the Next config source, like the route coverage test does.
 */
describe("the invite page never leaks its token through Referer", () => {
  const source = readFileSync(fileURLToPath(new URL("../../../app/next.config.ts", import.meta.url)), "utf8");

  it("sets Referrer-Policy: no-referrer on /admin/invite/:token", () => {
    expect(source).toMatch(/source:\s*"\/admin\/invite\/:token\*"[^}]*key:\s*"Referrer-Policy",\s*value:\s*"no-referrer"/);
  });
});
