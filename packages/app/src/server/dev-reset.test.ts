import { NotFoundError } from "@easyrms/core";
import { describe, expect, it, vi } from "vitest";

import { DevResetSeedFailedError, isDevResetAvailable, resetDevEnvironment, type DevResetDeps } from "./dev-reset";

describe("isDevResetAvailable", () => {
  it.each([
    ["development", undefined],
    ["development", "postgres://u:p@localhost:5432/easyrms"],
    ["development", "postgres://u:p@127.0.0.1:5432/easyrms"],
    ["development", "postgres://u:p@[::1]:5432/easyrms"],
    ["development", "postgres://u:p@LOCALHOST/easyrms"],
  ])("is true for %s with %s", (nodeEnv, databaseUrl) => {
    expect(isDevResetAvailable({ nodeEnv, databaseUrl })).toBe(true);
  });

  it.each([
    ["production", undefined],
    ["test", undefined],
    [undefined, undefined],
    ["development", "postgres://u:p@db.example.com:5432/easyrms"],
    ["development", "postgres://u:p@10.0.0.5:5432/easyrms"],
    ["development", "postgres://u:p@localhost.example.com/easyrms"],
    ["development", "not a url"],
  ])("is false for %s with %s", (nodeEnv, databaseUrl) => {
    expect(isDevResetAvailable({ nodeEnv, databaseUrl })).toBe(false);
  });
});

function deps(overrides: Partial<DevResetDeps> = {}): DevResetDeps {
  return {
    devResetPort: { truncateAll: vi.fn(async () => ["agents", "suppliers"]) },
    available: true,
    logger: { error: vi.fn() },
    seed: {
      supplierService: { list: async () => [], create: vi.fn(async (input) => ({ ...input, id: 1 }) as never) },
      agentService: { invite: vi.fn(async () => ({ agent: { id: 1 } as never, inviteToken: "t" })) },
      agentRepository: { findCredentialsByEmail: async () => null, consumeInvite: vi.fn(async () => ({ id: 1 }) as never) },
      passwordHasher: { hash: async () => "h", verify: async () => true, needsRehash: () => false },
      clock: () => new Date("2026-11-19T12:00:00Z"),
      nodeEnv: "development",
    },
    ...overrides,
  };
}

describe("resetDevEnvironment", () => {
  it("wipes first, then seeds the suppliers and the admin", async () => {
    const d = deps();

    const result = await resetDevEnvironment(d);

    expect(result).toEqual({ suppliersCreated: ["First Supplier", "Another Supplier"], suppliersKept: [], adminCreated: true, tablesEmptied: 2 });
    const wipe = vi.mocked(d.devResetPort.truncateAll).mock.invocationCallOrder[0];
    const seed = vi.mocked(d.seed.supplierService.create).mock.invocationCallOrder[0];
    expect(wipe).toBeLessThan(seed);
  });

  it("answers not found and touches nothing when the environment is not allowed", async () => {
    const d = deps({ available: false });

    await expect(resetDevEnvironment(d)).rejects.toBeInstanceOf(NotFoundError);

    expect(d.devResetPort.truncateAll).not.toHaveBeenCalled();
    expect(d.seed.supplierService.create).not.toHaveBeenCalled();
  });

  it("reports the recovery command when seeding fails after the wipe, without leaking the cause to the caller", async () => {
    const d = deps();
    vi.mocked(d.seed.supplierService.create).mockRejectedValueOnce(new Error("connection string postgres://u:secret@x"));

    const failure = await resetDevEnvironment(d).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(DevResetSeedFailedError);
    expect((failure as Error).message).toContain("npm run seed:dev");
    expect((failure as Error).message).not.toContain("secret");
    expect(d.logger.error).toHaveBeenCalledOnce();
  });

  it("does not seed when the wipe fails", async () => {
    const d = deps();
    vi.mocked(d.devResetPort.truncateAll).mockRejectedValueOnce(new Error("lock timeout"));

    await expect(resetDevEnvironment(d)).rejects.toThrow("lock timeout");

    expect(d.seed.supplierService.create).not.toHaveBeenCalled();
  });
});
