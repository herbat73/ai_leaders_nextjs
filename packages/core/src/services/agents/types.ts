export const AGENT_PERMISSIONS = ["MANAGE_RULES"] as const;
export type AgentPermission = (typeof AGENT_PERMISSIONS)[number];

export const AGENT_STATUSES = ["invited", "active", "disabled"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

/** An agent as lists and the session guard see it: never the password hash or an invite token. */
export interface AgentRecord {
  id: number;
  /** Trimmed and lower-cased; personal data, never logged. */
  email: string;
  displayName: string;
  permissions: AgentPermission[];
  status: AgentStatus;
  /** Incremented on disable, re-invite and invite acceptance; a session token with another epoch is rejected. */
  sessionEpoch: number;
}

/** Only `findCredentialsByEmail` returns this; the hash never leaves the repository and the login path. */
export interface AgentCredentials extends AgentRecord {
  passwordHash: string | null;
}

/** The authenticated agent a route or page works with. */
export interface AgentContext {
  id: number;
  email: string;
  displayName: string;
  permissions: AgentPermission[];
}

export interface NewInvitedAgent {
  email: string;
  displayName: string;
  permissions: AgentPermission[];
  /** SHA-256 hex of the one-time token. */
  inviteTokenHash: string;
  inviteExpiresAt: Date;
}

export type ReinviteAgent = Omit<NewInvitedAgent, "email">;

export type DisableOutcome =
  | { result: "disabled"; agent: AgentRecord }
  | { result: "not_found" }
  | { result: "last_manager" };

/** Port implemented by `@easyrms/db`. */
export interface AgentRepository {
  findCredentialsByEmail(email: string): Promise<AgentCredentials | null>;
  /** The agent only while its status is `active`; `null` for unknown, invited and disabled. */
  findActiveById(id: number): Promise<AgentRecord | null>;
  /** Any status, without credentials. */
  findById(id: number): Promise<AgentRecord | null>;
  /** Newest first. */
  list(): Promise<AgentRecord[]>;
  /** A duplicate e-mail, including a concurrent first invite losing the race, surfaces as `ConflictError`. */
  createInvited(input: NewInvitedAgent): Promise<AgentRecord>;
  /**
   * Replaces the open invite of a `disabled` or `invited` agent: new token, permissions and display name, password
   * cleared, status `invited`, `sessionEpoch` + 1. `null` when the agent does not exist or is `active`.
   */
  reinvite(id: number, input: ReinviteAgent): Promise<AgentRecord | null>;
  /**
   * One conditional update: matches only a live (unexpired, unused) token of an `invited` agent, sets the password,
   * status `active`, `sessionEpoch` + 1 and clears the token. `null` when nothing matched (unknown, expired or used).
   */
  consumeInvite(tokenHash: string, passwordHash: string, now: Date): Promise<AgentRecord | null>;
  /**
   * Disables an agent (`sessionEpoch` + 1, invite cleared) in a transaction that locks the active `MANAGE_RULES` rows,
   * so two managers disabling each other concurrently cannot both succeed. Already disabled is a no-op `disabled`.
   */
  disable(id: number): Promise<DisableOutcome>;
}
