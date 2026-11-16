import { describe, expect, it } from "vitest";

import { showAdminLoginLink } from "./admin-login-visibility";

describe("showAdminLoginLink", () => {
  it.each(["development", "test", undefined])("shows the link when NODE_ENV is %s", (env) => {
    expect(showAdminLoginLink(env)).toBe(true);
  });

  it("hides the link in production", () => {
    expect(showAdminLoginLink("production")).toBe(false);
  });
});
