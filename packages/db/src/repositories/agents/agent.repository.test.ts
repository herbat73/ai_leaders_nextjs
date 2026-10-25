import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConflictError, type NewInvitedAgent } from "@easyrms/core";

import { createTestDatabase, type TestDatabase } from "../../test-support/postgres";
import { MikroOrmAgentRepository } from "./agent.repository";

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.migrateUp();
});

afterAll(async () => {
  await db?.close();
});

/** Each call gets its own fork: its own identity map, and its own connection whenever a transaction opens. */
const repository = (): MikroOrmAgentRepository => new MikroOrmAgentRepository({ em: db.fork() });

let counter = 0;
const hashOf = (n: number): string => String(n).padStart(64, "0");
const future = (): Date => new Date(Date.now() + 72 * 3600_000);

function invite(overrides: Partial<NewInvitedAgent> = {}): NewInvitedAgent {
  counter += 1;
  return {
    email: `agent${counter}@example.com`,
    displayName: `Agent ${counter}`,
    permissions: [],
    inviteTokenHash: hashOf(counter),
    inviteExpiresAt: future(),
    ...overrides,
  };
}

/** An active manager or plain agent, created through the repository like production code would. */
async function activeAgent(permissions: NewInvitedAgent["permissions"] = []): Promise<number> {
  const input = invite({ permissions });
  const created = await repository().createInvited(input);
  const accepted = await repository().consumeInvite(input.inviteTokenHash, "scrypt$16$8$1$c2FsdA==$aGFzaA==", new Date());
  expect(accepted?.id).toBe(created.id);
  return created.id;
}

describe("createInvited and reads", () => {
  it("stores the e-mail trimmed and lower-cased, as invited with epoch 0, and finds credentials case-insensitively", async () => {
    const created = await repository().createInvited(invite({ email: "  Ala@Example.COM ", permissions: ["MANAGE_RULES"] }));

    expect(created).toMatchObject({ email: "ala@example.com", status: "invited", sessionEpoch: 0, permissions: ["MANAGE_RULES"] });
    const credentials = await repository().findCredentialsByEmail("ALA@example.com ");
    expect(credentials).toMatchObject({ id: created.id, passwordHash: null, status: "invited" });
    expect(await repository().findCredentialsByEmail("nobody@example.com")).toBeNull();
  });

  it("never exposes credentials or tokens on the record types", async () => {
    const created = await repository().createInvited(invite());
    expect(Object.keys(created).sort()).toEqual(["displayName", "email", "id", "permissions", "sessionEpoch", "status"]);
    expect(Object.keys((await repository().list())[0]).sort()).toEqual(["displayName", "email", "id", "permissions", "sessionEpoch", "status"]);
  });

  it("answers 409 for a duplicate e-mail, including concurrent first invites", async () => {
    const email = `race${Date.now()}@example.com`;
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => repository().createInvited(invite({ email, inviteTokenHash: hashOf(1_000_000 + ++counter) }))),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    for (const result of results) {
      if (result.status === "rejected") expect(result.reason).toBeInstanceOf(ConflictError);
    }
  });

  it("finds an agent as active only after the invite is accepted", async () => {
    const input = invite();
    const created = await repository().createInvited(input);
    expect(await repository().findActiveById(created.id)).toBeNull();
    expect((await repository().findById(created.id))?.status).toBe("invited");

    await repository().consumeInvite(input.inviteTokenHash, "scrypt$16$8$1$c2FsdA==$aGFzaA==", new Date());
    expect((await repository().findActiveById(created.id))?.status).toBe("active");
  });
});

describe("consumeInvite", () => {
  it("sets the password, activates, bumps the epoch and clears the token", async () => {
    const input = invite();
    const created = await repository().createInvited(input);

    const accepted = await repository().consumeInvite(input.inviteTokenHash, "scrypt$16$8$1$c2FsdA==$aGFzaA==", new Date());

    expect(accepted).toMatchObject({ id: created.id, status: "active", sessionEpoch: 1 });
    expect(await repository().findCredentialsByEmail(input.email)).toMatchObject({ passwordHash: "scrypt$16$8$1$c2FsdA==$aGFzaA==" });
    const [row] = await db.query<{ invite_token_hash: string | null; invite_expires_at: Date | null }>(
      `select "invite_token_hash", "invite_expires_at" from "agents" where "id" = ?`,
      [created.id],
    );
    expect(row).toEqual({ invite_token_hash: null, invite_expires_at: null });
  });

  it("is single-use even when eight accepts race", async () => {
    const input = invite();
    await repository().createInvited(input);

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) => repository().consumeInvite(input.inviteTokenHash, `scrypt$16$8$1$c2FsdA==$${index}`, new Date())),
    );

    expect(results.filter((result) => result !== null)).toHaveLength(1);
    const [row] = await db.query<{ session_epoch: number }>(`select "session_epoch" from "agents" where "email" = ?`, [input.email]);
    expect(row.session_epoch).toBe(1);
  });

  it("matches nothing for an unknown, expired or already used token", async () => {
    const expired = invite({ inviteExpiresAt: new Date(Date.now() - 1000) });
    await repository().createInvited(expired);
    const used = invite();
    await repository().createInvited(used);
    await repository().consumeInvite(used.inviteTokenHash, "scrypt$16$8$1$c2FsdA==$aGFzaA==", new Date());

    expect(await repository().consumeInvite(hashOf(999_999_999), "x", new Date())).toBeNull();
    expect(await repository().consumeInvite(expired.inviteTokenHash, "x", new Date())).toBeNull();
    expect(await repository().consumeInvite(used.inviteTokenHash, "x", new Date())).toBeNull();
  });

  it("treats the expiry instant as expired", async () => {
    const at = new Date("2026-10-24T12:00:00.000Z");
    const input = invite({ inviteExpiresAt: at });
    await repository().createInvited(input);
    expect(await repository().consumeInvite(input.inviteTokenHash, "x", at)).toBeNull();
  });
});

describe("reinvite", () => {
  it("replaces the token, password, permissions and name, and bumps the epoch; the old link stops working", async () => {
    const first = invite({ permissions: ["MANAGE_RULES"] });
    const created = await repository().createInvited(first);
    await repository().consumeInvite(first.inviteTokenHash, "scrypt$16$8$1$c2FsdA==$aGFzaA==", new Date());
    await activeAgent(["MANAGE_RULES"]); // so the next disable is not the last manager
    expect((await repository().disable(created.id)).result).toBe("disabled");

    const second = { displayName: "New Name", permissions: [] as [], inviteTokenHash: hashOf(777_000), inviteExpiresAt: future() };
    const reinvited = await repository().reinvite(created.id, second);

    expect(reinvited).toMatchObject({ id: created.id, status: "invited", displayName: "New Name", permissions: [], sessionEpoch: 3 });
    expect(await repository().findCredentialsByEmail(first.email)).toMatchObject({ passwordHash: null });
    expect(await repository().consumeInvite(first.inviteTokenHash, "x", new Date())).toBeNull();
    expect(await repository().consumeInvite(second.inviteTokenHash, "y", new Date())).toMatchObject({ id: created.id, status: "active" });
  });

  it("replaces the token of a still-invited agent, and refuses an active or unknown agent", async () => {
    const input = invite();
    const created = await repository().createInvited(input);
    const next = { displayName: "Again", permissions: [] as [], inviteTokenHash: hashOf(777_001), inviteExpiresAt: future() };
    expect(await repository().reinvite(created.id, next)).toMatchObject({ status: "invited" });
    expect(await repository().consumeInvite(input.inviteTokenHash, "x", new Date())).toBeNull();

    const active = await activeAgent();
    expect(await repository().reinvite(active, { ...next, inviteTokenHash: hashOf(777_002) })).toBeNull();
    expect(await repository().reinvite(987_654, { ...next, inviteTokenHash: hashOf(777_003) })).toBeNull();
  });
});

describe("disable", () => {
  it("disables, bumps the epoch, clears the invite and hides the agent from findActiveById", async () => {
    await activeAgent(["MANAGE_RULES"]);
    const id = await activeAgent();

    const outcome = await repository().disable(id);

    expect(outcome).toMatchObject({ result: "disabled", agent: { id, status: "disabled", sessionEpoch: 2 } });
    expect(await repository().findActiveById(id)).toBeNull();
  });

  it("is idempotent for an already disabled agent and answers not_found for an unknown one", async () => {
    await activeAgent(["MANAGE_RULES"]);
    const id = await activeAgent();
    await repository().disable(id);

    expect(await repository().disable(id)).toMatchObject({ result: "disabled", agent: { sessionEpoch: 2 } });
    expect(await repository().disable(987_654)).toEqual({ result: "not_found" });
  });

  it("refuses to disable the only active manager", async () => {
    // A fresh schema: the shared one already holds other managers from the tests above.
    const isolated = await createTestDatabase();
    try {
      await isolated.migrateUp();
      const repo = () => new MikroOrmAgentRepository({ em: isolated.fork() });
      const input = invite({ permissions: ["MANAGE_RULES"] });
      const manager = await repo().createInvited(input);
      await repo().consumeInvite(input.inviteTokenHash, "h", new Date());

      expect(await repo().disable(manager.id)).toEqual({ result: "last_manager" });
      expect((await repo().findActiveById(manager.id))?.status).toBe("active");
    } finally {
      await isolated.close();
    }
  });

  it("lets exactly one of two managers disable the other when they race", async () => {
    const isolated = await createTestDatabase();
    try {
      await isolated.migrateUp();
      const repo = () => new MikroOrmAgentRepository({ em: isolated.fork() });
      const ids: number[] = [];
      for (const permissions of [["MANAGE_RULES"], ["MANAGE_RULES"]] as const) {
        const input = invite({ permissions: [...permissions] });
        ids.push((await repo().createInvited(input)).id);
        await repo().consumeInvite(input.inviteTokenHash, "h", new Date());
      }

      const outcomes = await Promise.all([repo().disable(ids[0]), repo().disable(ids[1])]);

      expect(outcomes.map((outcome) => outcome.result).sort()).toEqual(["disabled", "last_manager"]);
      const active = await isolated.query<{ id: number }>(`select "id" from "agents" where "status" = 'active'`);
      expect(active).toHaveLength(1);
    } finally {
      await isolated.close();
    }
  });

  it("does not count agents without MANAGE_RULES as managers", async () => {
    const isolated = await createTestDatabase();
    try {
      await isolated.migrateUp();
      const repo = () => new MikroOrmAgentRepository({ em: isolated.fork() });
      const plainInput = invite();
      const plain = await repo().createInvited(plainInput);
      await repo().consumeInvite(plainInput.inviteTokenHash, "h", new Date());

      // No manager exists at all, so disabling a plain agent must not trip the last-manager guard.
      expect(await repo().disable(plain.id)).toMatchObject({ result: "disabled" });
    } finally {
      await isolated.close();
    }
  });
});
