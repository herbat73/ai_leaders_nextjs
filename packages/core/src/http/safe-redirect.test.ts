import { describe, expect, it } from "vitest";
import { sanitizeAdminNext } from "./safe-redirect";

describe("sanitizeAdminNext", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/returns", "/admin/returns"],
    ["/admin/returns/42", "/admin/returns/42"],
    ["/admin/returns?status=approved", "/admin/returns?status=approved"],
    ["/admin?x=1", "/admin?x=1"],
  ])("keeps %s", (input, expected) => {
    expect(sanitizeAdminNext(input)).toBe(expected);
  });

  it.each([
    "https://evil.example/admin",
    "//evil.example/admin",
    "///evil.example",
    "/\\evil.example",
    "/admin\\..\\evil",
    "/administrator",
    "/adminx/returns",
    "/",
    "/returns/lookup",
    "admin/returns",
    "javascript:alert(1)",
    "/admin/../returns",
    "/admin/%2e%2e/returns",
    "/admin/./returns",
    "/admin/returns\n/x",
    "/admin/returns\u0000",
    "",
    "   ",
  ])("falls back for %j", (input) => {
    expect(sanitizeAdminNext(input)).toBe("/admin/returns");
  });

  it("falls back for missing and array input, and honors a custom fallback", () => {
    expect(sanitizeAdminNext(undefined)).toBe("/admin/returns");
    expect(sanitizeAdminNext(null)).toBe("/admin/returns");
    expect(sanitizeAdminNext(["/admin/returns"])).toBe("/admin/returns");
    expect(sanitizeAdminNext("//x", "/admin")).toBe("/admin");
  });

  it("drops a fragment instead of passing it through", () => {
    expect(sanitizeAdminNext("/admin/returns#frag")).toBe("/admin/returns");
  });
});
