import { describe, expect, it } from "vitest";
import { ForbiddenError } from "../../errors";
import { hasPermission, requirePermission } from "./permissions";

describe("permissions", () => {
  it("allows an agent that holds the permission", () => {
    expect(hasPermission({ permissions: ["MANAGE_RULES"] }, "MANAGE_RULES")).toBe(true);
    expect(() => requirePermission({ permissions: ["MANAGE_RULES"] }, "MANAGE_RULES")).not.toThrow();
  });

  it("throws a 403 with code forbidden for an agent without it", () => {
    expect(hasPermission({ permissions: [] }, "MANAGE_RULES")).toBe(false);
    try {
      requirePermission({ permissions: [] }, "MANAGE_RULES");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error).toMatchObject({ status: 403, code: "forbidden" });
    }
  });
});
