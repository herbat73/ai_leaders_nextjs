import { describe, expect, it } from "vitest";
import { isAgentProtectedPath, isApiPath } from "./agent-routes";

describe("isAgentProtectedPath", () => {
  it.each([
    "/admin",
    "/admin/returns",
    "/admin/returns/5",
    "/admin/returns/5/customer-view",
    "/admin/discovery/case-sample",
    "/admin/agents",
    "/admin/invite",
    "/admin/invite/abc/extra",
    "/admin/login/extra",
    "/api/agents",
    "/api/agents/logout",
    "/api/agents/5",
    "/api/agents/invite",
    "/api/agents/login/x",
    "/api/discovery/case-sample",
    "/api/discovery",
    "/api/returns/5",
    "/api/returns/123456",
  ])("protects %s", (path) => {
    expect(isAgentProtectedPath(path)).toBe(true);
  });

  it.each([
    "/",
    "/returns",
    "/returns/new",
    "/returns/RMA-2026-00001",
    "/admin/login",
    "/admin/invite/abc123",
    "/admin/invite/Zk-_9",
    "/api/agents/login",
    "/api/agents/invite/accept",
    "/api/returns",
    "/api/returns/lookup",
    "/api/returns/quote",
    "/api/returns/session",
    "/api/returns/5/extra",
    "/api/health",
    "/administrator",
    "/api/agentsx",
  ])("leaves %s public", (path) => {
    expect(isAgentProtectedPath(path)).toBe(false);
  });

  it("is case-sensitive like the router", () => {
    expect(isAgentProtectedPath("/Admin/returns")).toBe(false);
  });
});

describe("isApiPath", () => {
  it("distinguishes API paths from pages", () => {
    expect(isApiPath("/api/returns/5")).toBe(true);
    expect(isApiPath("/api")).toBe(true);
    expect(isApiPath("/admin/returns")).toBe(false);
    expect(isApiPath("/apiary")).toBe(false);
  });
});
