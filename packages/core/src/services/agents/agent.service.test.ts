import { describe, expect, it, vi } from "vitest";

import { ConflictError, NotFoundError, TooManyRequestsError } from "../../errors";
import { RateLimiter } from "../../security/rate-limiter";
import type { MailMessage, MailPort } from "../mail/mail.port";
import { AgentSessionService } from "./agent-session.service";
import {
  AgentRuleError,
  AgentService,
  AGENT_INVITE_TTL_MS,
  hashInviteToken,
  InvalidCredentialsError,
  InviteInvalidError,
} from "./agent.service";
import { BusyError } from "./hash-limiter";
import type { PasswordHasher } from "./password-hasher";
import type {
  AgentCredentials,
  AgentPermission,
  AgentRecord,
  AgentRepository,
  AgentStatus,
  DisableOutcome,
} from "./types";

const T0 = new Date("2026-10-24T10:00:00Z");
const SECRET = "s".repeat(40);

interface StoredAgent extends AgentRecord {
  passwordHash: string | null;
  inviteTokenHash: string | null;
  inviteExpiresAt: Date | null;
}

const strip = (row: StoredAgent): AgentRecord => ({
  id: row.id,
  email: row.email,
  displayName: row.displayName,
  permissions: row.permissions,
  status: row.status,
  sessionEpoch: row.sessionEpoch,
});

/** In-memory stand-in for the `db` port with the same invite, epoch and last-manager semantics. */
function makeRepository(clock: () => Date) {
  const rows: StoredAgent[] = [];
  let nextId = 1;
  const repository: AgentRepository = {
    findCredentialsByEmail: async (email) => {
      const row = rows.find((candidate) => candidate.email === email.trim().toLowerCase());
      return row ? ({ ...strip(row), passwordHash: row.passwordHash } satisfies AgentCredentials) : null;
    },
    findActiveById: async (id) => {
      const row = rows.find((candidate) => candidate.id === id && candidate.status === "active");
      return row ? strip(row) : null;
    },
    findById: async (id) => {
      const row = rows.find((candidate) => candidate.id === id);
      return row ? strip(row) : null;
    },
    list: async () => rows.map(strip),
    createInvited: async (input) => {
      if (rows.some((row) => row.email === input.email)) throw new ConflictError("duplicate");
      const row: StoredAgent = {
        id: nextId++,
        email: input.email,
        displayName: input.displayName,
        permissions: input.permissions,
        status: "invited",
        sessionEpoch: 0,
        passwordHash: null,
        inviteTokenHash: input.inviteTokenHash,
        inviteExpiresAt: input.inviteExpiresAt,
      };
      rows.push(row);
      return strip(row);
    },
    reinvite: async (id, input) => {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row || row.status === "active") return null;
      Object.assign(row, {
        displayName: input.displayName,
        permissions: input.permissions,
        passwordHash: null,
        status: "invited" as AgentStatus,
        sessionEpoch: row.sessionEpoch + 1,
        inviteTokenHash: input.inviteTokenHash,
        inviteExpiresAt: input.inviteExpiresAt,
      });
      return strip(row);
    },
    consumeInvite: async (tokenHash, passwordHash, now) => {
      const row = rows.find(
        (candidate) =>
          candidate.inviteTokenHash === tokenHash &&
          candidate.status === "invited" &&
          candidate.inviteExpiresAt !== null &&
          candidate.inviteExpiresAt > now,
      );
      if (!row) return null;
      Object.assign(row, {
        passwordHash,
        status: "active" as AgentStatus,
        sessionEpoch: row.sessionEpoch + 1,
        inviteTokenHash: null,
        inviteExpiresAt: null,
      });
      return strip(row);
    },
    disable: async (id): Promise<DisableOutcome> => {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) return { result: "not_found" };
      const managers = rows.filter((candidate) => candidate.status === "active" && candidate.permissions.includes("MANAGE_RULES"));
      if (row.status !== "disabled" && managers.length <= 1 && managers.includes(row)) return { result: "last_manager" };
      if (row.status !== "disabled") Object.assign(row, { status: "disabled", sessionEpoch: row.sessionEpoch + 1, inviteTokenHash: null });
      return { result: "disabled", agent: strip(row) };
    },
  };
  void clock;
  return { repository, rows };
}

function makeHasher() {
  const hasher: PasswordHasher & { verify: ReturnType<typeof vi.fn>; hash: ReturnType<typeof vi.fn> } = {
    hash: vi.fn(async (password: string) => `hash:${password}`),
    verify: vi.fn(async (password: string, stored: string) => stored === `hash:${password}`),
    needsRehash: () => false,
  };
  return hasher;
}

function setup(options: { mail?: MailPort; hasher?: PasswordHasher } = {}) {
  let now = T0;
  const clock = () => now;
  const { repository, rows } = makeRepository(clock);
  const hasher = (options.hasher ?? makeHasher()) as ReturnType<typeof makeHasher>;
  const sent: MailMessage[] = [];
  const mailPort: MailPort = options.mail ?? { send: (message) => void sent.push(message) };
  const logger = { error: vi.fn() };
  let tokenCounter = 0;
  const sessions = new AgentSessionService({ secret: SECRET, ttlSeconds: 8 * 3600, clock });
  const service = new AgentService({
    agentRepository: repository,
    passwordHasher: hasher,
    agentSessionService: sessions,
    rateLimiter: new RateLimiter({ clock }),
    mailPort,
    logger,
    clock,
  }, { inviteTokenGenerator: () => `token-${++tokenCounter}` });
  return {
    service,
    rows,
    hasher,
    sent,
    logger,
    sessions,
    advance: (ms: number) => void (now = new Date(now.getTime() + ms)),
  };
}

type Setup = ReturnType<typeof setup>;

async function activeAgent(s: Setup, email = "ala@example.com", permissions: AgentPermission[] = [], password = "correct horse battery") {
  const { agent, inviteToken } = await s.service.invite({ email, displayName: "Ala", permissions });
  await s.service.acceptInvite({ ip: "9.9.9.9", token: inviteToken, password });
  return { id: agent.id, email, password };
}

const login = (s: Setup, email: string, password: string, ip = "1.1.1.1") => s.service.login({ email, password, ip });

describe("login", () => {
  it("signs an active agent in and the session authenticates", async () => {
    const s = setup();
    const { id, email, password } = await activeAgent(s);

    const outcome = await login(s, " ALA@example.com ", password);

    expect(outcome.agent).toMatchObject({ id, email, displayName: "Ala", permissions: [] });
    expect(await s.service.authenticate(outcome.sessionToken)).toMatchObject({ id });
  });

  it("answers every failure with the same error and always runs one hash verification", async () => {
    const s = setup();
    const { email, password } = await activeAgent(s);
    const invited = await s.service.invite({ email: "invited@example.com", displayName: "I", permissions: [] });
    expect(invited.inviteToken).toBeTruthy();
    const disabled = await activeAgent(s, "disabled@example.com", [], "another good password");
    await activeAgent(s, "manager@example.com", ["MANAGE_RULES"], "manager password 1");
    await s.service.disable(999, disabled.id);

    const attempts: [string, string][] = [
      ["nobody@example.com", password],
      [email, "wrong password!!"],
      ["invited@example.com", "whatever password"],
      ["disabled@example.com", "another good password"],
    ];
    for (const [attemptEmail, attemptPassword] of attempts) {
      s.hasher.verify.mockClear();
      const error = await login(s, attemptEmail, attemptPassword, `ip-${attemptEmail}`).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(InvalidCredentialsError);
      expect(error).toMatchObject({ status: 401, code: "invalid_credentials", message: "Invalid e-mail or password" });
      expect(s.hasher.verify).toHaveBeenCalledTimes(1);
    }
  });

  it("answers 429 after five failures per (e-mail, IP), even for the right password, and other IPs are unaffected", async () => {
    const s = setup();
    const { email, password } = await activeAgent(s);
    for (let i = 0; i < 5; i += 1) await expect(login(s, email, "bad password 1")).rejects.toBeInstanceOf(InvalidCredentialsError);

    await expect(login(s, email, password)).rejects.toBeInstanceOf(TooManyRequestsError);
    await expect(login(s, email, password, "2.2.2.2")).resolves.toBeDefined();
    await expect(login(s, "other@example.com", "bad password 1")).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("counts failures for unknown e-mails too, and lets the window reset", async () => {
    const s = setup();
    for (let i = 0; i < 5; i += 1) await expect(login(s, "ghost@example.com", "bad password 1")).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(login(s, "ghost@example.com", "bad password 1")).rejects.toBeInstanceOf(TooManyRequestsError);

    s.advance(10 * 60_000);
    await expect(login(s, "ghost@example.com", "bad password 1")).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("answers 429 after ten attempts per minute from one IP", async () => {
    const s = setup();
    const { password } = await activeAgent(s);
    for (let i = 0; i < 10; i += 1) await login(s, "ala@example.com", password);
    await expect(login(s, "ala@example.com", password)).rejects.toBeInstanceOf(TooManyRequestsError);
    s.advance(60_000);
    await expect(login(s, "ala@example.com", password)).resolves.toBeDefined();
  });

  it("a success does not spend a failed-attempt slot", async () => {
    const s = setup();
    const { email, password } = await activeAgent(s);
    for (let i = 0; i < 4; i += 1) await expect(login(s, email, "bad password 1")).rejects.toBeInstanceOf(InvalidCredentialsError);
    await login(s, email, password);
    await login(s, email, password);

    // Four failures plus any number of successes leave exactly one failure in the budget.
    await expect(login(s, email, "bad password 1")).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(login(s, email, password)).rejects.toBeInstanceOf(TooManyRequestsError);
  });

  it("locks an e-mail after 20 failures in an hour whatever the IP, so spoofed addresses do not reset the budget", async () => {
    const s = setup();
    const { email, password } = await activeAgent(s);
    for (let i = 0; i < 20; i += 1) await expect(login(s, email, "bad password 1", `10.0.0.${i}`)).rejects.toBeInstanceOf(InvalidCredentialsError);

    await expect(login(s, email, password, "10.9.9.9")).rejects.toBeInstanceOf(TooManyRequestsError);
    await expect(login(s, "other@example.com", "bad password 1", "10.9.9.9")).rejects.toBeInstanceOf(InvalidCredentialsError);
    s.advance(60 * 60_000);
    await expect(login(s, email, password, "10.9.9.9")).resolves.toBeDefined();
  });

  it("successes do not count toward the per-account budget", async () => {
    const s = setup();
    const { email, password } = await activeAgent(s);
    for (let i = 0; i < 30; i += 1) {
      await login(s, email, password, `10.1.0.${i}`);
    }
    await expect(login(s, email, password, "10.1.9.9")).resolves.toBeDefined();
  });

  it("spends no budget when the hasher is busy", async () => {
    const s = setup();
    const { email, password } = await activeAgent(s);
    s.hasher.verify.mockRejectedValue(new BusyError());
    for (let i = 0; i < 12; i += 1) await expect(login(s, email, password)).rejects.toBeInstanceOf(BusyError);
    s.hasher.verify.mockImplementation(async (p: string, stored: string) => stored === `hash:${p}`);
    await expect(login(s, email, password)).resolves.toBeDefined();
  });
});

describe("invite and accept", () => {
  it("stores only the token hash, expires in 72 hours and sends the link by mail", async () => {
    const s = setup();

    const { agent, inviteToken } = await s.service.invite({
      email: " New@Example.com ",
      displayName: "Nowy",
      permissions: ["MANAGE_RULES"],
      inviteLinkBase: "https://rms.example/admin/invite/",
    });

    expect(agent).toMatchObject({ email: "new@example.com", status: "invited", permissions: ["MANAGE_RULES"] });
    const stored = s.rows[0];
    expect(stored.inviteTokenHash).toBe(hashInviteToken(inviteToken));
    expect(stored.inviteTokenHash).not.toContain(inviteToken);
    expect(stored.inviteExpiresAt?.getTime()).toBe(T0.getTime() + AGENT_INVITE_TTL_MS);
    expect(s.sent).toEqual([
      {
        template: "agent_invite",
        to: "new@example.com",
        data: {
          displayName: "Nowy",
          inviteUrl: `https://rms.example/admin/invite/${inviteToken}`,
          expiresAt: new Date(T0.getTime() + AGENT_INVITE_TTL_MS).toISOString(),
        },
      },
    ]);
  });

  it("accepting sets the password, activates the agent and starts a session", async () => {
    const s = setup();
    const { agent, inviteToken } = await s.service.invite({ email: "a@example.com", displayName: "A", permissions: [] });

    const outcome = await s.service.acceptInvite({ ip: "9.9.9.9", token: inviteToken, password: "a long enough password" });

    expect(outcome.agent.id).toBe(agent.id);
    expect(s.rows[0]).toMatchObject({ status: "active", passwordHash: "hash:a long enough password", inviteTokenHash: null, sessionEpoch: 1 });
    expect(await s.service.authenticate(outcome.sessionToken)).toMatchObject({ id: agent.id });
    await expect(login(s, "a@example.com", "a long enough password")).resolves.toBeDefined();
  });

  it("answers invite_invalid for an unknown, used or expired token", async () => {
    const s = setup();
    const { inviteToken } = await s.service.invite({ email: "a@example.com", displayName: "A", permissions: [] });
    await expect(s.service.acceptInvite({ ip: "9.9.9.9", token: "nope", password: "a long enough password" })).rejects.toBeInstanceOf(InviteInvalidError);

    await s.service.acceptInvite({ ip: "9.9.9.9", token: inviteToken, password: "a long enough password" });
    await expect(s.service.acceptInvite({ ip: "9.9.9.9", token: inviteToken, password: "another long password" })).rejects.toMatchObject({
      status: 400,
      code: "invite_invalid",
    });

    const late = await s.service.invite({ email: "b@example.com", displayName: "B", permissions: [] });
    s.advance(AGENT_INVITE_TTL_MS);
    await expect(s.service.acceptInvite({ ip: "9.9.9.9", token: late.inviteToken, password: "a long enough password" })).rejects.toBeInstanceOf(InviteInvalidError);
  });

  it("throttles invite acceptance per IP before hashing, so bogus tokens cannot starve the hash slots", async () => {
    const s = setup();
    for (let i = 0; i < 10; i += 1) {
      await expect(s.service.acceptInvite({ ip: "7.7.7.7", token: `bogus-${i}`, password: "a long enough password" })).rejects.toBeInstanceOf(InviteInvalidError);
    }
    s.hasher.hash.mockClear();

    await expect(s.service.acceptInvite({ ip: "7.7.7.7", token: "bogus-x", password: "a long enough password" })).rejects.toBeInstanceOf(TooManyRequestsError);
    expect(s.hasher.hash).not.toHaveBeenCalled();
    await expect(s.service.acceptInvite({ ip: "8.8.8.8", token: "bogus-y", password: "a long enough password" })).rejects.toBeInstanceOf(InviteInvalidError);
  });

  it("answers 409 for an e-mail that is already active", async () => {
    const s = setup();
    await activeAgent(s);
    await expect(s.service.invite({ email: "ALA@example.com", displayName: "X", permissions: [] })).rejects.toBeInstanceOf(ConflictError);
  });

  it("re-inviting a disabled agent resets the password and epoch, replaces permissions and kills the old link and session", async () => {
    const s = setup();
    await activeAgent(s, "boss@example.com", ["MANAGE_RULES"], "boss password 123");
    const { id, email, password } = await activeAgent(s, "ala@example.com", ["MANAGE_RULES"]);
    const oldSession = (await login(s, email, password)).sessionToken;
    await s.service.disable(999, id);
    expect(await s.service.authenticate(oldSession)).toBeNull();

    const again = await s.service.invite({ email, displayName: "Ala 2", permissions: [] });
    expect(again.agent).toMatchObject({ id, status: "invited", permissions: [], displayName: "Ala 2" });
    expect(s.rows.find((row) => row.id === id)?.passwordHash).toBeNull();
    await expect(login(s, email, password)).rejects.toBeInstanceOf(InvalidCredentialsError);

    await s.service.acceptInvite({ ip: "9.9.9.9", token: again.inviteToken, password: "brand new password" });
    expect(await s.service.authenticate(oldSession)).toBeNull();
  });

  it("re-inviting a still-invited agent replaces the earlier link", async () => {
    const s = setup();
    const first = await s.service.invite({ email: "a@example.com", displayName: "A", permissions: [] });
    const second = await s.service.invite({ email: "a@example.com", displayName: "A", permissions: [] });
    await expect(s.service.acceptInvite({ ip: "9.9.9.9", token: first.inviteToken, password: "a long enough password" })).rejects.toBeInstanceOf(InviteInvalidError);
    await expect(s.service.acceptInvite({ ip: "9.9.9.9", token: second.inviteToken, password: "a long enough password" })).resolves.toBeDefined();
  });

  it("swallows a mail failure, still returns the token and logs neither token nor address", async () => {
    const s = setup({
      mail: {
        send: () => {
          throw new Error("smtp down");
        },
      },
    });

    const outcome = await s.service.invite({ email: "jane@example.com", displayName: "J", permissions: [] });

    expect(outcome.inviteToken).toBe("token-1");
    expect(s.logger.error).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(s.logger.error.mock.calls);
    expect(logged).not.toContain("token-1");
    expect(logged).not.toContain("jane@example.com");
    expect(logged).toContain("j***@example.com");
  });
});

describe("authenticate", () => {
  it("rejects missing, garbage, disabled, unknown-agent and wrong-epoch tokens", async () => {
    const s = setup();
    await activeAgent(s, "boss@example.com", ["MANAGE_RULES"], "boss password 123");
    const { id, email, password } = await activeAgent(s, "ala@example.com");
    const { sessionToken } = await login(s, email, password);
    expect(await s.service.authenticate(sessionToken)).toMatchObject({ id });
    expect(await s.service.authenticate(null)).toBeNull();
    expect(await s.service.authenticate("garbage")).toBeNull();

    const ghost = await s.sessions.issue({ agentId: 424242, epoch: 0 });
    expect(await s.service.authenticate(ghost)).toBeNull();
    const stale = await s.sessions.issue({ agentId: id, epoch: 0 });
    expect(await s.service.authenticate(stale)).toBeNull();

    await s.service.disable(999, id);
    expect(await s.service.authenticate(sessionToken)).toBeNull();
  });

  it("expires with the eight hour session", async () => {
    const s = setup();
    const { email, password } = await activeAgent(s);
    const { sessionToken } = await login(s, email, password);
    s.advance(8 * 3600_000 + 1000);
    expect(await s.service.authenticate(sessionToken)).toBeNull();
  });
});

describe("disable", () => {
  it("refuses to disable yourself and the last manager, and reports unknown agents", async () => {
    const s = setup();
    const boss = await activeAgent(s, "boss@example.com", ["MANAGE_RULES"], "boss password 123");
    const other = await activeAgent(s, "other@example.com");

    await expect(s.service.disable(boss.id, boss.id)).rejects.toMatchObject({ status: 409, code: "self_disable" });
    await expect(s.service.disable(other.id, boss.id)).rejects.toMatchObject({ status: 409, code: "last_manager" });
    await expect(s.service.disable(boss.id, 424242)).rejects.toBeInstanceOf(NotFoundError);
    expect(new AgentRuleError("x", "last_manager").status).toBe(409);
  });

  it("disables a plain agent and bumps the epoch", async () => {
    const s = setup();
    const boss = await activeAgent(s, "boss@example.com", ["MANAGE_RULES"], "boss password 123");
    const other = await activeAgent(s, "other@example.com");

    const disabled = await s.service.disable(boss.id, other.id);

    expect(disabled).toMatchObject({ id: other.id, status: "disabled", sessionEpoch: 2 });
    expect((await s.service.list()).map((agent) => agent.status)).toEqual(["active", "disabled"]);
  });
});
