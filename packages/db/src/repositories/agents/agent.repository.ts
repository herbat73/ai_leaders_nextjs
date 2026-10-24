import { TransactionPropagation, UniqueConstraintViolationException } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import {
  AGENT_PERMISSIONS,
  AGENT_STATUSES,
  ConflictError,
  type AgentCredentials,
  type AgentPermission,
  type AgentRecord,
  type AgentRepository,
  type AgentStatus,
  type DisableOutcome,
  type NewInvitedAgent,
  type ReinviteAgent,
} from "@easyrms/core";

import { AgentSchema, type AgentEntity } from "../../entities";

const EMAIL_CONSTRAINT = "agents_email_unique";
const MANAGE_RULES: AgentPermission = "MANAGE_RULES";

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** Narrows stored strings to the domain unions; unknown values (hand edit) are dropped or treated as `disabled`. */
const toStatus = (value: string): AgentStatus => AGENT_STATUSES.find((status) => status === value) ?? "disabled";
const toPermissions = (values: readonly string[] | null | undefined): AgentPermission[] =>
  AGENT_PERMISSIONS.filter((permission) => values?.includes(permission));

function toRecord(entity: AgentEntity): AgentRecord {
  return {
    id: entity.id,
    email: entity.email,
    displayName: entity.displayName,
    permissions: toPermissions(entity.permissions),
    status: toStatus(entity.status),
    sessionEpoch: entity.sessionEpoch,
  };
}

interface AgentRow {
  id: number;
  email: string;
  display_name: string;
  permissions: string[];
  status: string;
  session_epoch: number;
}

const rowToRecord = (row: AgentRow): AgentRecord => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  permissions: toPermissions(row.permissions),
  status: toStatus(row.status),
  sessionEpoch: row.session_epoch,
});

const joinOrOpen = (): { propagation: TransactionPropagation } => ({ propagation: TransactionPropagation.REQUIRED });

export class MikroOrmAgentRepository implements AgentRepository {
  private readonly em: EntityManager;

  constructor({ em }: { em: EntityManager }) {
    this.em = em;
  }

  async findCredentialsByEmail(email: string): Promise<AgentCredentials | null> {
    const row = await this.em.findOne(AgentSchema, { email: normalizeEmail(email) }, { refresh: true });
    return row ? { ...toRecord(row), passwordHash: row.passwordHash ?? null } : null;
  }

  async findActiveById(id: number): Promise<AgentRecord | null> {
    const row = await this.em.findOne(AgentSchema, { id, status: "active" }, { refresh: true });
    return row ? toRecord(row) : null;
  }

  async findById(id: number): Promise<AgentRecord | null> {
    const row = await this.em.findOne(AgentSchema, { id }, { refresh: true });
    return row ? toRecord(row) : null;
  }

  async list(): Promise<AgentRecord[]> {
    const rows = await this.em.find(AgentSchema, {}, { orderBy: { createdAt: "desc", id: "desc" }, refresh: true });
    return rows.map(toRecord);
  }

  async createInvited(input: NewInvitedAgent): Promise<AgentRecord> {
    try {
      return await this.em.transactional(async (tx) => {
        const row = tx.create(AgentSchema, {
          email: normalizeEmail(input.email),
          displayName: input.displayName,
          permissions: input.permissions,
          status: "invited",
          sessionEpoch: 0,
          inviteTokenHash: input.inviteTokenHash,
          inviteExpiresAt: input.inviteExpiresAt,
        });
        await tx.flush();
        return toRecord(row);
      }, joinOrOpen());
    } catch (error) {
      // Two concurrent first invites for one e-mail: the unique index decides, the loser gets a 409, not a 500.
      if (error instanceof UniqueConstraintViolationException && error.message.includes(EMAIL_CONSTRAINT)) {
        throw new ConflictError("An agent with this e-mail already exists");
      }
      throw error;
    }
  }

  async reinvite(id: number, input: ReinviteAgent): Promise<AgentRecord | null> {
    const rows = await this.em.execute<AgentRow[]>(
      `update "agents" set "display_name" = ?, "permissions" = ?::text[], "password_hash" = null, "status" = 'invited',
         "session_epoch" = "session_epoch" + 1, "invite_token_hash" = ?, "invite_expires_at" = ?, "updated_at" = ?
       where "id" = ? and "status" in ('invited', 'disabled')
       returning "id", "email", "display_name", "permissions", "status", "session_epoch"`,
      [input.displayName, toPgArray(input.permissions), input.inviteTokenHash, input.inviteExpiresAt, new Date(), id],
    );
    return rows.length === 1 ? rowToRecord(rows[0]) : null;
  }

  async consumeInvite(tokenHash: string, passwordHash: string, now: Date): Promise<AgentRecord | null> {
    // One statement, so a second accept racing the first matches no row (the token was cleared by the winner).
    const rows = await this.em.execute<AgentRow[]>(
      `update "agents" set "password_hash" = ?, "status" = 'active', "session_epoch" = "session_epoch" + 1,
         "invite_token_hash" = null, "invite_expires_at" = null, "updated_at" = ?
       where "invite_token_hash" = ? and "invite_expires_at" > ? and "status" = 'invited'
       returning "id", "email", "display_name", "permissions", "status", "session_epoch"`,
      [passwordHash, now, tokenHash, now],
    );
    return rows.length === 1 ? rowToRecord(rows[0]) : null;
  }

  disable(id: number): Promise<DisableOutcome> {
    // Runs on the callback's EntityManager: `this.em` is a plain fork and would run outside the transaction.
    return this.em.transactional(async (tx): Promise<DisableOutcome> => {
      // Lock the active managers in a fixed order. A concurrent disable waits here, then re-evaluates the predicate
      // against the committed state, so two managers disabling each other cannot both pass the last-manager check.
      const managers = await tx.execute<{ id: number }[]>(
        `select "id" from "agents" where "status" = 'active' and ? = any("permissions") order by "id" for update`,
        [MANAGE_RULES],
      );
      const target = await tx.findOne(AgentSchema, { id }, { refresh: true });
      if (!target) return { result: "not_found" };
      if (toStatus(target.status) === "disabled") return { result: "disabled", agent: toRecord(target) };
      if (managers.length <= 1 && managers.some((manager) => manager.id === id)) return { result: "last_manager" };

      await tx.nativeUpdate(
        AgentSchema,
        { id },
        {
          status: "disabled",
          sessionEpoch: target.sessionEpoch + 1,
          inviteTokenHash: null,
          inviteExpiresAt: null,
          updatedAt: new Date(),
        },
      );
      const updated = await tx.findOneOrFail(AgentSchema, { id }, { refresh: true });
      return { result: "disabled", agent: toRecord(updated) };
    }, joinOrOpen());
  }
}

/** `text[]` literal for a bound parameter; permissions come from a closed allow-list, so no escaping is needed. */
function toPgArray(values: readonly string[]): string {
  return `{${values.join(",")}}`;
}
