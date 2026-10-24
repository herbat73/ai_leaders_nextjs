import { SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import { ConfigurationError } from "../../errors";
import { GuestSessionService } from "../returns/guest-session.service";
import {
  AGENT_SESSION_TTL_SECONDS,
  AgentSessionService,
  resolveAgentSessionSecret,
} from "./agent-session.service";

const SECRET = "a".repeat(40);
const OTHER_SECRET = "b".repeat(40);
const T0 = new Date("2026-10-24T10:00:00Z");

function service(options: { secret?: string | null; now?: () => Date } = {}): AgentSessionService {
  return new AgentSessionService({
    secret: options.secret === undefined ? SECRET : options.secret,
    ttlSeconds: AGENT_SESSION_TTL_SECONDS,
    clock: options.now ?? (() => T0),
  });
}

describe("AgentSessionService", () => {
  it("round-trips the agent id and epoch", async () => {
    const s = service();
    expect(await s.verify(await s.issue({ agentId: 7, epoch: 3 }))).toEqual({ agentId: 7, epoch: 3 });
  });

  it("expires after eight hours", async () => {
    let now = T0;
    const s = service({ now: () => now });
    const token = await s.issue({ agentId: 1, epoch: 0 });
    now = new Date(T0.getTime() + AGENT_SESSION_TTL_SECONDS * 1000 - 1000);
    expect(await s.verify(token)).not.toBeNull();
    now = new Date(T0.getTime() + AGENT_SESSION_TTL_SECONDS * 1000 + 1000);
    expect(await s.verify(token)).toBeNull();
  });

  it("rejects a tampered token, a foreign secret, garbage and empty input", async () => {
    const s = service();
    const token = await s.issue({ agentId: 1, epoch: 0 });
    expect(await s.verify(`${token}x`)).toBeNull();
    expect(await service({ secret: OTHER_SECRET }).verify(token)).toBeNull();
    expect(await s.verify("not-a-jwt")).toBeNull();
    expect(await s.verify("")).toBeNull();
    expect(await s.verify(null)).toBeNull();
  });

  it("rejects a token with the wrong audience even when signed with the same secret", async () => {
    const now = Math.floor(T0.getTime() / 1000);
    const forged = await new SignJWT({ ep: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("1")
      .setAudience("customer")
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(new TextEncoder().encode(SECRET));
    expect(await service().verify(forged)).toBeNull();
  });

  it("rejects tokens with a missing or malformed subject or epoch", async () => {
    const now = Math.floor(T0.getTime() / 1000);
    const sign = (claims: Record<string, unknown>, sub?: string) => {
      const jwt = new SignJWT(claims)
        .setProtectedHeader({ alg: "HS256" })
        .setAudience("agent")
        .setIssuedAt(now)
        .setExpirationTime(now + 60);
      return (sub === undefined ? jwt : jwt.setSubject(sub)).sign(new TextEncoder().encode(SECRET));
    };
    expect(await service().verify(await sign({ ep: 0 }))).toBeNull();
    expect(await service().verify(await sign({ ep: 0 }, "abc"))).toBeNull();
    expect(await service().verify(await sign({ ep: "0" }, "1"))).toBeNull();
    expect(await service().verify(await sign({}, "1"))).toBeNull();
  });

  it("cannot issue or verify without a secret", async () => {
    const s = service({ secret: null });
    await expect(s.issue({ agentId: 1, epoch: 0 })).rejects.toBeInstanceOf(ConfigurationError);
    expect(await s.verify(await service().issue({ agentId: 1, epoch: 0 }))).toBeNull();
  });

  describe("separation from guest sessions (both directions)", () => {
    it("rejects a guest token, even one signed with the agent secret", async () => {
      const guest = new GuestSessionService({ secret: SECRET, ttlSeconds: 60, clock: () => T0 });
      expect(await service().verify(await guest.issue("ORDER-1"))).toBeNull();
    });

    it("the guest service rejects an agent token, even one signed with the guest secret", async () => {
      const guest = new GuestSessionService({ secret: SECRET, ttlSeconds: 60, clock: () => T0 });
      expect(await guest.verify(await service().issue({ agentId: 1, epoch: 0 }))).toBeNull();
    });
  });
});

describe("resolveAgentSessionSecret", () => {
  const base = { devSecretProvider: () => "d".repeat(32), warn: vi.fn() };

  it("returns an explicit secret of at least 32 bytes", () => {
    expect(resolveAgentSessionSecret({ ...base, nodeEnv: "production", secret: ` ${SECRET} ` })).toBe(SECRET);
  });

  it("rejects a short explicit secret in every environment", () => {
    for (const nodeEnv of ["production", "development", undefined]) {
      expect(() => resolveAgentSessionSecret({ ...base, nodeEnv, secret: "short" })).toThrow(ConfigurationError);
    }
  });

  it("fails closed outside development when the secret is missing", () => {
    for (const nodeEnv of ["production", "test", undefined]) {
      expect(() => resolveAgentSessionSecret({ ...base, nodeEnv, secret: undefined })).toThrow(ConfigurationError);
    }
  });

  it("uses an ephemeral secret with one warning in development", () => {
    const warn = vi.fn();
    expect(resolveAgentSessionSecret({ ...base, warn, nodeEnv: "development", secret: "  " })).toBe("d".repeat(32));
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
