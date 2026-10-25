import { describe, expect, it } from "vitest";
import {
  agentInviteAcceptSchema,
  agentInviteSchema,
  agentLoginSchema,
  agentUpdateSchema,
  normalizeAgentEmail,
} from "./agent.schema";

describe("agent schemas", () => {
  it("normalizes the e-mail on login and invite", () => {
    expect(normalizeAgentEmail("  Ala@Example.COM ")).toBe("ala@example.com");
    expect(agentLoginSchema.parse({ email: " Ala@Example.COM ", password: "x" }).email).toBe("ala@example.com");
    expect(agentInviteSchema.parse({ email: "A@B.pl", displayName: " Ala " }).displayName).toBe("Ala");
  });

  it("login validates format only: any non-empty password up to 128 characters", () => {
    expect(agentLoginSchema.safeParse({ email: "a@b.pl", password: "x" }).success).toBe(true);
    expect(agentLoginSchema.safeParse({ email: "a@b.pl", password: "" }).success).toBe(false);
    expect(agentLoginSchema.safeParse({ email: "a@b.pl", password: "x".repeat(129) }).success).toBe(false);
    expect(agentLoginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });

  it("accept requires 12 to 128 characters and no composition rules", () => {
    const parse = (password: string) => agentInviteAcceptSchema.safeParse({ token: "t", password }).success;
    expect(parse("a".repeat(11))).toBe(false);
    expect(parse("a".repeat(12))).toBe(true);
    expect(parse("a".repeat(128))).toBe(true);
    expect(parse("a".repeat(129))).toBe(false);
    expect(agentInviteAcceptSchema.safeParse({ token: "", password: "a".repeat(12) }).success).toBe(false);
  });

  it("invite defaults permissions to none and accepts only the allow-list", () => {
    expect(agentInviteSchema.parse({ email: "a@b.pl", displayName: "A" }).permissions).toEqual([]);
    expect(agentInviteSchema.parse({ email: "a@b.pl", displayName: "A", permissions: ["MANAGE_RULES"] }).permissions).toEqual([
      "MANAGE_RULES",
    ]);
    expect(agentInviteSchema.safeParse({ email: "a@b.pl", displayName: "A", permissions: ["ROOT"] }).success).toBe(false);
    expect(agentInviteSchema.safeParse({ email: "a@b.pl", displayName: "" }).success).toBe(false);
    expect(agentInviteSchema.safeParse({ email: "a@b.pl", displayName: "x".repeat(101) }).success).toBe(false);
  });

  it("update only allows disabling", () => {
    expect(agentUpdateSchema.safeParse({ status: "disabled" }).success).toBe(true);
    expect(agentUpdateSchema.safeParse({ status: "active" }).success).toBe(false);
  });
});
