import { hashInviteToken, type AgentCredentials, type NewSupplier, type Supplier } from "@easyrms/core";
import { describe, expect, it, vi } from "vitest";

import { DEV_SEED_ADMIN, DEV_SEED_SUPPLIERS, DevSeedRefusedError, seedDevData, type DevSeedDeps } from "./dev-seed";

const NOW = new Date("2026-11-16T12:00:00Z");

const supplier = (name: string, id: number): Supplier => ({
  id,
  name,
  email: `${id}@example.com`,
  guidelines: null,
  active: true,
  createdAt: NOW,
  updatedAt: NOW,
});

/** In-memory fakes of the four collaborators; `state` shows what the seeder left behind. */
function fakes(initial: { suppliers?: Supplier[]; agentEmail?: string } = {}) {
  const state = { suppliers: [...(initial.suppliers ?? [])], agents: new Set(initial.agentEmail ? [initial.agentEmail] : []) };
  const tokens = new Map<string, string>();
  const deps: DevSeedDeps = {
    supplierService: {
      list: async () => state.suppliers,
      create: vi.fn(async (input: NewSupplier) => {
        const created = { ...supplier(input.name, state.suppliers.length + 1), email: input.email };
        state.suppliers.push(created);
        return created;
      }),
    },
    agentService: {
      invite: vi.fn(async (input) => {
        const inviteToken = `token-${state.agents.size}`;
        tokens.set(hashInviteToken(inviteToken), input.email);
        state.agents.add(input.email);
        // The seeder only needs the token; the rest of the record is irrelevant here.
        return { agent: { id: 1, email: input.email } as never, inviteToken };
      }),
    },
    agentRepository: {
      findCredentialsByEmail: async (email) => (state.agents.has(email) ? ({ email } as AgentCredentials) : null),
      consumeInvite: vi.fn(async (tokenHash: string) => (tokens.has(tokenHash) ? ({ id: 1 } as never) : null)),
    },
    passwordHasher: { hash: vi.fn(async (password: string) => `hashed:${password}`), verify: async () => true, needsRehash: () => false },
    clock: () => NOW,
    nodeEnv: "development",
  };
  return { deps, state };
}

describe("seedDevData", () => {
  it("creates the two suppliers from the issue and an admin with a hashed password", async () => {
    const { deps, state } = fakes();

    const result = await seedDevData(deps);

    expect(result).toEqual({ suppliersCreated: ["First Supplier", "Another Supplier"], suppliersKept: [], adminCreated: true });
    expect(state.suppliers.map(({ name, email }) => ({ name, email }))).toEqual([
      { name: "First Supplier", email: "firstsupplier@example.com" },
      { name: "Another Supplier", email: "anothersupplier@example.com" },
    ]);
    expect(deps.agentService.invite).toHaveBeenCalledWith({ email: "admin@example.com", displayName: "Dev Admin", permissions: ["MANAGE_RULES"] });
    expect(deps.passwordHasher.hash).toHaveBeenCalledWith("123412341234");
    // The invite is consumed with the hash, never the clear password.
    expect(deps.agentRepository.consumeInvite).toHaveBeenCalledWith(hashInviteToken("token-0"), "hashed:123412341234", NOW);
  });

  it("is idempotent: a second run creates and invites nothing", async () => {
    const { deps } = fakes();
    await seedDevData(deps);
    vi.mocked(deps.supplierService.create).mockClear();
    vi.mocked(deps.agentService.invite).mockClear();

    const second = await seedDevData(deps);

    expect(second).toEqual({ suppliersCreated: [], suppliersKept: ["First Supplier", "Another Supplier"], adminCreated: false });
    expect(deps.supplierService.create).not.toHaveBeenCalled();
    expect(deps.agentService.invite).not.toHaveBeenCalled();
  });

  it("leaves an existing agent with that e-mail alone, whatever its status (no password reset, no re-invite)", async () => {
    const { deps } = fakes({ agentEmail: DEV_SEED_ADMIN.email });

    const result = await seedDevData(deps);

    expect(result.adminCreated).toBe(false);
    expect(deps.agentService.invite).not.toHaveBeenCalled();
    expect(deps.passwordHasher.hash).not.toHaveBeenCalled();
  });

  it("matches existing suppliers by name case-insensitively and creates only the missing one", async () => {
    const { deps } = fakes({ suppliers: [supplier("FIRST SUPPLIER", 7)] });

    const result = await seedDevData(deps);

    expect(result.suppliersKept).toEqual(["First Supplier"]);
    expect(result.suppliersCreated).toEqual(["Another Supplier"]);
    expect(deps.supplierService.create).toHaveBeenCalledTimes(1);
  });

  it("refuses in production before touching anything", async () => {
    const { deps } = fakes();

    await expect(seedDevData({ ...deps, nodeEnv: "production" })).rejects.toBeInstanceOf(DevSeedRefusedError);

    expect(deps.supplierService.create).not.toHaveBeenCalled();
    expect(deps.agentService.invite).not.toHaveBeenCalled();
  });

  it("seeds under test and with NODE_ENV unset (only production is refused)", async () => {
    for (const nodeEnv of ["test", undefined]) {
      const { deps } = fakes();
      await expect(seedDevData({ ...deps, nodeEnv })).resolves.toMatchObject({ adminCreated: true });
    }
  });

  it("fails loudly when the invite cannot be consumed", async () => {
    const { deps } = fakes();
    vi.mocked(deps.agentRepository.consumeInvite).mockResolvedValueOnce(null);

    await expect(seedDevData(deps)).rejects.toThrow(/could not be accepted/);
  });

  it("keeps the seed within the issue and the password policy", () => {
    expect(DEV_SEED_SUPPLIERS.map(({ email }) => email)).toEqual(["firstsupplier@example.com", "anothersupplier@example.com"]);
    expect(DEV_SEED_ADMIN.password.length).toBeGreaterThanOrEqual(12);
  });
});
