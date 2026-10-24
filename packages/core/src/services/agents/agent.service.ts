import { createHash, randomBytes } from "node:crypto";

import { AppError, ConflictError, NotFoundError, TooManyRequestsError } from "../../errors";
import type { ApiLogger } from "../../http/types";
import type { RateLimiter, RateRule } from "../../security/rate-limiter";
import { normalizeAgentEmail, type AgentInviteInput } from "../../validators/agents/agent.schema";
import { maskEmail, type MailPort } from "../mail/mail.port";
import type { AgentSessionService } from "./agent-session.service";
import type { PasswordHasher } from "./password-hasher";
import type { AgentContext, AgentCredentials, AgentRecord, AgentRepository } from "./types";

export const AGENT_INVITE_TTL_MS = 72 * 3600_000;

export const AGENT_RATE_RULES = {
  /** Login attempts per client IP. */
  login: { limit: 10, windowMs: 60_000 },
  /** Failed logins per (e-mail, client IP). */
  failedLogin: { limit: 5, windowMs: 10 * 60_000 },
} as const satisfies Record<string, RateRule>;

export const agentRateKeys = {
  login: (ip: string): string => `agent-login:${ip}`,
  failedLogin: (email: string, ip: string): string => `agent-login-failed:${normalizeAgentEmail(email)}:${ip}`,
} as const;

/** Every login failure (unknown e-mail, wrong password, disabled, not yet accepted) is this one error. */
export class InvalidCredentialsError extends AppError {
  constructor() {
    super("Invalid e-mail or password", 401, "invalid_credentials");
  }
}

/** Unknown, expired and already used invite tokens are indistinguishable. */
export class InviteInvalidError extends AppError {
  constructor() {
    super("This invite link is invalid or has expired", 400, "invite_invalid");
  }
}

/** A business rule of agent management with its own machine code (`self_disable`, `last_manager`). */
export class AgentRuleError extends AppError {
  constructor(message: string, code: "self_disable" | "last_manager") {
    super(message, 409, code);
  }
}

/** SHA-256 hex of an invite token; only this form is ever stored. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const newInviteToken = (): string => randomBytes(32).toString("base64url");

export interface InviteOutcome {
  agent: AgentRecord;
  /** Shown once to the inviting agent; never stored or logged. */
  inviteToken: string;
}

export interface AgentSessionOutcome {
  agent: AgentContext;
  /** Signed session token for the cookie. */
  sessionToken: string;
}

export interface AgentServiceDeps {
  agentRepository: AgentRepository;
  /** Already wrapped with `limitHashConcurrency` by the composition root. */
  passwordHasher: PasswordHasher;
  agentSessionService: AgentSessionService;
  rateLimiter: RateLimiter;
  mailPort: MailPort;
  logger: ApiLogger;
  clock: () => Date;
}

export interface AgentServiceOptions {
  /** Test seam; defaults to 32 random bytes, base64url. (Not a dependency: Awilix's strict proxy would demand a registration.) */
  inviteTokenGenerator?: () => string;
}

/** One dummy hash per hasher (the container shares one), so an unknown e-mail costs one hash, not an extra one per request. */
const dummyHashes = new WeakMap<PasswordHasher, Promise<string>>();

const toContext = (agent: AgentRecord): AgentContext => ({
  id: agent.id,
  email: agent.email,
  displayName: agent.displayName,
  permissions: agent.permissions,
});

/**
 * Agent accounts: invite, accept, login, disable and session resolution. Credentials and invite tokens never leave
 * this class except as the one-time token returned to the inviter and the session token for the cookie.
 */
export class AgentService {
  private readonly agentRepository: AgentRepository;
  private readonly passwordHasher: PasswordHasher;
  private readonly agentSessionService: AgentSessionService;
  private readonly rateLimiter: RateLimiter;
  private readonly mailPort: MailPort;
  private readonly logger: ApiLogger;
  private readonly clock: () => Date;
  private readonly inviteTokenGenerator: () => string;

  constructor(deps: AgentServiceDeps, options: AgentServiceOptions = {}) {
    this.agentRepository = deps.agentRepository;
    this.passwordHasher = deps.passwordHasher;
    this.agentSessionService = deps.agentSessionService;
    this.rateLimiter = deps.rateLimiter;
    this.mailPort = deps.mailPort;
    this.logger = deps.logger;
    this.clock = deps.clock;
    this.inviteTokenGenerator = options.inviteTokenGenerator ?? newInviteToken;
  }

  /**
   * Creates an invited agent, or re-invites a `disabled` or still-`invited` one (new token, password cleared, epoch
   * bumped, permissions replaced). An `active` e-mail is a 409. `inviteLinkBase` (e.g. `https://host/admin/invite`)
   * only shapes the link inside the `agent_invite` mail; the mail is best effort and never fails the request.
   */
  async invite(input: AgentInviteInput & { inviteLinkBase?: string }): Promise<InviteOutcome> {
    const email = normalizeAgentEmail(input.email);
    const inviteToken = this.inviteTokenGenerator();
    const fields = {
      inviteTokenHash: hashInviteToken(inviteToken),
      inviteExpiresAt: new Date(this.clock().getTime() + AGENT_INVITE_TTL_MS),
      displayName: input.displayName,
      permissions: input.permissions,
    };

    const existing = await this.agentRepository.findCredentialsByEmail(email);
    let agent: AgentRecord | null;
    if (!existing) {
      agent = await this.agentRepository.createInvited({ email, ...fields });
    } else if (existing.status === "active") {
      throw new ConflictError("An agent with this e-mail already exists");
    } else {
      // `null` also covers the agent becoming active between the read and the update.
      agent = await this.agentRepository.reinvite(existing.id, fields);
      if (!agent) throw new ConflictError("An agent with this e-mail already exists");
    }

    await this.sendInviteMail(agent, inviteToken, input.inviteLinkBase, fields.inviteExpiresAt);
    return { agent, inviteToken };
  }

  /** Sets the password for a live invite and signs the agent in. Any bad token is `InviteInvalidError`. */
  async acceptInvite(input: { token: string; password: string }): Promise<AgentSessionOutcome> {
    // Hash first: the cost is the same whether or not the token matches, and the conditional update stays atomic.
    const passwordHash = await this.passwordHasher.hash(input.password);
    const agent = await this.agentRepository.consumeInvite(hashInviteToken(input.token), passwordHash, this.clock());
    if (!agent) throw new InviteInvalidError();
    return this.startSession(agent);
  }

  /**
   * Budgets: logins per IP and failed logins per (e-mail, IP) are reserved first (429). A hash verification always
   * runs, against a dummy hash when the agent is unknown or has no password, so timing does not reveal existence. A
   * success refunds the failed-attempt slot; every failure keeps it.
   */
  async login(input: { email: string; password: string; ip: string }): Promise<AgentSessionOutcome> {
    const email = normalizeAgentEmail(input.email);
    const loginKey = agentRateKeys.login(input.ip);
    const failedKey = agentRateKeys.failedLogin(email, input.ip);
    if (!this.rateLimiter.consume(loginKey, AGENT_RATE_RULES.login).allowed) throw new TooManyRequestsError();
    if (!this.rateLimiter.consume(failedKey, AGENT_RATE_RULES.failedLogin).allowed) {
      this.rateLimiter.release(loginKey);
      throw new TooManyRequestsError();
    }

    let verified: boolean;
    let credentials: AgentCredentials | null;
    try {
      credentials = await this.agentRepository.findCredentialsByEmail(email);
      const stored = credentials?.passwordHash ?? (await this.getDummyHash());
      verified = await this.passwordHasher.verify(input.password, stored);
    } catch (error) {
      // A busy hasher or a database failure says nothing about the credentials: no budget is spent.
      this.rateLimiter.release(loginKey);
      this.rateLimiter.release(failedKey);
      throw error;
    }

    if (!credentials || !credentials.passwordHash || !verified || credentials.status !== "active") {
      throw new InvalidCredentialsError();
    }
    this.rateLimiter.release(failedKey);
    return this.startSession(credentials);
  }

  /**
   * The agent behind a session token, or `null`: signature, audience and expiry (JWT), then the database: the agent
   * must exist, be `active` and have the same `sessionEpoch`, so disabling takes effect on the next request.
   */
  async authenticate(token: string | null | undefined): Promise<AgentContext | null> {
    const claims = await this.agentSessionService.verify(token);
    if (!claims) return null;
    const agent = await this.agentRepository.findActiveById(claims.agentId);
    if (!agent || agent.sessionEpoch !== claims.epoch) return null;
    return toContext(agent);
  }

  list(): Promise<AgentRecord[]> {
    return this.agentRepository.list();
  }

  /** `actingAgentId` is the caller; disabling yourself and disabling the last manager are 409s with their own code. */
  async disable(actingAgentId: number, targetId: number): Promise<AgentRecord> {
    if (actingAgentId === targetId) throw new AgentRuleError("You cannot disable your own account", "self_disable");
    const outcome = await this.agentRepository.disable(targetId);
    if (outcome.result === "not_found") throw new NotFoundError("Agent not found");
    if (outcome.result === "last_manager") {
      throw new AgentRuleError("At least one active agent must keep the MANAGE_RULES permission", "last_manager");
    }
    return outcome.agent;
  }

  private async startSession(agent: AgentRecord): Promise<AgentSessionOutcome> {
    const sessionToken = await this.agentSessionService.issue({ agentId: agent.id, epoch: agent.sessionEpoch });
    return { agent: toContext(agent), sessionToken };
  }

  private getDummyHash(): Promise<string> {
    // Cached, but a failed attempt (a busy hasher) is not: the next login tries again.
    let pending = dummyHashes.get(this.passwordHasher);
    if (!pending) {
      const hasher = this.passwordHasher;
      pending = hasher.hash(randomBytes(16).toString("hex")).catch((error: unknown) => {
        dummyHashes.delete(hasher);
        throw error;
      });
      dummyHashes.set(hasher, pending);
    }
    return pending;
  }

  private async sendInviteMail(agent: AgentRecord, token: string, linkBase: string | undefined, expiresAt: Date): Promise<void> {
    try {
      await this.mailPort.send({
        template: "agent_invite",
        to: agent.email,
        data: {
          displayName: agent.displayName,
          inviteUrl: linkBase ? `${linkBase.replace(/\/+$/, "")}/${token}` : null,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (error) {
      // Best effort (the `MailPort` contract); the link is still returned to the inviter. No token, no address.
      this.logger.error("mail send failed", {
        template: "agent_invite",
        to: maskEmail(agent.email),
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  }
}

