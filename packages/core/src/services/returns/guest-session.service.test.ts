import { SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import { ConfigurationError } from "../../errors";
import { GuestSessionService, resolveGuestSessionSecret } from "./guest-session.service";

const SECRET = "s".repeat(32);
const T0 = new Date("2026-10-23T10:00:00Z");

function service(now: { value: Date }, secret: string | null = SECRET): GuestSessionService {
  return new GuestSessionService({ secret, ttlSeconds: 7200, clock: () => now.value });
}

describe("GuestSessionService", () => {
  it("signs and verifies the canonical order number", async () => {
    const svc = service({ value: T0 });
    const token = await svc.issue("EZ-1001");
    expect(await svc.verify(token)).toEqual({ orderNumber: "EZ-1001" });
    expect(await svc.assertOrder(token, "EZ-1001")).toBe(true);
  });

  it("rejects a different order number", async () => {
    const svc = service({ value: T0 });
    expect(await svc.assertOrder(await svc.issue("EZ-1001"), "EZ-1002")).toBe(false);
  });

  it("expires after the ttl (injected clock)", async () => {
    const now = { value: T0 };
    const svc = service(now);
    const token = await svc.issue("EZ-1001");
    now.value = new Date(T0.getTime() + 7199_000);
    expect(await svc.verify(token)).not.toBeNull();
    now.value = new Date(T0.getTime() + 7201_000);
    expect(await svc.verify(token)).toBeNull();
  });

  it("rejects tampered tokens and garbage without throwing", async () => {
    const svc = service({ value: T0 });
    const token = await svc.issue("EZ-1001");
    const [h, p, s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ order: "EZ-9999", exp: 9999999999 })).toString("base64url");
    expect(await svc.verify(`${h}.${forged}.${s}`)).toBeNull();
    expect(await svc.verify(`${h}.${p}.${s?.slice(0, -2)}xx`)).toBeNull();
    for (const bad of ["", "a.b.c", "not-a-jwt", null, undefined, "....", "a".repeat(10_000)]) {
      expect(await svc.verify(bad)).toBeNull();
    }
  });

  it("rejects tokens signed with another secret", async () => {
    const other = service({ value: T0 }, "o".repeat(32));
    expect(await service({ value: T0 }).verify(await other.issue("EZ-1001"))).toBeNull();
  });

  it("rejects alg none and HS512 tokens", async () => {
    const svc = service({ value: T0 });
    const exp = Math.floor(T0.getTime() / 1000) + 3600;
    const b64 = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString("base64url");
    const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ order: "EZ-1001", exp })}.`;
    expect(await svc.verify(none)).toBeNull();
    const hs512 = await new SignJWT({ order: "EZ-1001" })
      .setProtectedHeader({ alg: "HS512" })
      .setExpirationTime(exp)
      .sign(new TextEncoder().encode(SECRET));
    expect(await svc.verify(hs512)).toBeNull();
  });

  it("rejects a valid token without the order claim", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(T0.getTime() / 1000) + 3600)
      .sign(new TextEncoder().encode(SECRET));
    expect(await service({ value: T0 }).verify(token)).toBeNull();
  });

  it("with no secret cannot issue and verifies nothing", async () => {
    const svc = service({ value: T0 }, null);
    await expect(svc.issue("EZ-1001")).rejects.toThrow(ConfigurationError);
    expect(await svc.verify("a.b.c")).toBeNull();
  });
});

describe("resolveGuestSessionSecret", () => {
  const base = { devSecretProvider: () => "d".repeat(48), warn: vi.fn() };

  it("returns a configured secret of at least 32 bytes", () => {
    expect(resolveGuestSessionSecret({ ...base, nodeEnv: "production", secret: SECRET })).toBe(SECRET);
  });

  it("throws outside development when missing", () => {
    for (const nodeEnv of ["production", "test", undefined]) {
      for (const secret of [undefined, "", "  "]) {
        expect(() => resolveGuestSessionSecret({ ...base, nodeEnv, secret })).toThrow(ConfigurationError);
      }
    }
  });

  it("throws when shorter than 32 bytes, in any environment", () => {
    for (const nodeEnv of ["production", "development"]) {
      expect(() => resolveGuestSessionSecret({ ...base, nodeEnv, secret: "s".repeat(31) })).toThrow(ConfigurationError);
    }
  });

  it("counts bytes, not characters", () => {
    expect(resolveGuestSessionSecret({ ...base, nodeEnv: "production", secret: "ą".repeat(16) })).toBe("ą".repeat(16));
  });

  it("uses an ephemeral secret in development with exactly one warning", () => {
    const warn = vi.fn();
    const secret = resolveGuestSessionSecret({ ...base, warn, nodeEnv: "development", secret: undefined });
    expect(secret).toBe("d".repeat(48));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("does not warn when a secret is configured", () => {
    const warn = vi.fn();
    resolveGuestSessionSecret({ ...base, warn, nodeEnv: "development", secret: SECRET });
    expect(warn).not.toHaveBeenCalled();
  });
});
