import { TransactionPropagation } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import {
  DECISION_STATUSES,
  formatRma,
  RETURN_KIND,
  RETURN_STATUSES,
  toReturnStatus,
  type ApiLogger,
  type NewReturnRequest,
  type ReturnDetail,
  type ReturnEvent,
  type ReturnListFilter,
  type ReturnRepository,
  type ReturnRequest,
  type ReturnStatus,
  type StoredReturnStatus,
  type TransitionOutcome,
} from "@easyrms/core";

import {
  ReturnRequestEventSchema,
  ReturnRequestSchema,
  type ReturnRequestEntity,
  type ReturnRequestEventEntity,
} from "../../entities";

/**
 * Joins the caller's transaction when there is one, otherwise opens its own (the default, NESTED, is a savepoint).
 * A fresh object per call: `em.transactional` writes `ctx` into the options it is given, so a shared constant would
 * carry the first caller's transaction into every later call.
 */
const joinOrOpen = (): { propagation: TransactionPropagation } => ({ propagation: TransactionPropagation.REQUIRED });

function toDomain(entity: ReturnRequestEntity): ReturnRequest {
  return {
    id: entity.id,
    rma: entity.rma,
    // `kind` is a column for later specs; only "return" exists today.
    kind: RETURN_KIND,
    orderNumber: entity.orderNumber,
    customerEmail: entity.customerEmail,
    // TODO(step 1.3): the domain `reason` becomes nullable; coerced here until then.
    reason: entity.reason ?? "",
    status: toReturnStatus(entity.status),
    hasDecisionNote: Boolean(entity.decisionNote),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

function toEvent(entity: ReturnRequestEventEntity): ReturnEvent {
  return {
    id: entity.id,
    // Written only by this repository, which only ever writes the values of the domain union.
    type: entity.type as ReturnEvent["type"],
    fromStatus: entity.fromStatus ? toReturnStatus(entity.fromStatus) : null,
    toStatus: toReturnStatus(entity.toStatus),
    note: entity.note ?? null,
    actor: entity.actor as ReturnEvent["actor"],
    createdAt: entity.createdAt,
  };
}

export class MikroOrmReturnRepository implements ReturnRepository {
  private readonly em: EntityManager;
  private readonly logger: ApiLogger;

  constructor({ em, logger }: { em: EntityManager; logger: ApiLogger }) {
    this.em = em;
    this.logger = logger;
  }

  async list(filter: ReturnListFilter = {}): Promise<ReturnRequest[]> {
    const where =
      filter.status === undefined
        ? {}
        : filter.status === "unknown"
          ? { status: { $nin: [...RETURN_STATUSES] } }
          : { status: filter.status };
    const rows = await this.em.find(ReturnRequestSchema, where, { orderBy: { createdAt: "desc", id: "desc" } });
    const requests = rows.map(toDomain);
    const corrupt = requests.filter((request) => request.status === "unknown").map((request) => request.id);
    if (corrupt.length > 0) this.logger.error("Return requests with an unknown status", { ids: corrupt });
    return requests;
  }

  async findDetail(id: number): Promise<ReturnDetail | null> {
    // `refresh`: `findStatus` may have loaded a partial entity into this scope's identity map.
    const row = await this.em.findOne(ReturnRequestSchema, { id }, { refresh: true });
    if (!row) return null;
    const events = await this.em.find(
      ReturnRequestEventSchema,
      { returnRequest: id },
      { orderBy: { createdAt: "asc", id: "asc" } },
    );
    return { request: toDomain(row), decisionNote: row.decisionNote ?? null, events: events.map(toEvent) };
  }

  async findStatus(id: number): Promise<StoredReturnStatus | null> {
    const row = await this.em.findOne(ReturnRequestSchema, { id }, { fields: ["status"], refresh: true });
    return row ? toReturnStatus(row.status) : null;
  }

  create(input: NewReturnRequest): Promise<ReturnRequest> {
    return this.em.transactional(async (tx) => {
      // The sequence is not part of the entity model, so this is one of the two raw statements (the other is the migration).
      const [{ seq }] = await tx.execute<{ seq: string }[]>(`select nextval('return_rma_seq') as "seq"`);
      const createdAt = new Date();
      const row = tx.create(ReturnRequestSchema, {
        ...input,
        rma: formatRma(Number(seq), createdAt),
        kind: RETURN_KIND,
        status: "submitted",
        createdAt,
        updatedAt: createdAt,
      });
      tx.create(ReturnRequestEventSchema, {
        returnRequest: row,
        type: "submitted",
        fromStatus: null,
        toStatus: "submitted",
        note: null,
        actor: "system",
        createdAt,
      });
      await tx.flush();
      return toDomain(row);
    }, joinOrOpen());
  }

  transition(id: number, from: ReturnStatus, to: ReturnStatus, note: string | null): Promise<TransitionOutcome> {
    // Runs on the callback's EntityManager: `this.em` is a plain fork and would run outside the transaction.
    return this.em.transactional(async (tx): Promise<TransitionOutcome> => {
      const now = new Date();
      // `nativeUpdate` skips the `onUpdate` hook, so `updatedAt` is set here; the note is touched only by decisions.
      const data = (DECISION_STATUSES as readonly ReturnStatus[]).includes(to)
        ? { status: to, updatedAt: now, decisionNote: note }
        : { status: to, updatedAt: now };
      const updated = await tx.nativeUpdate(ReturnRequestSchema, { id, status: from }, data);

      if (updated === 0) {
        // `nativeUpdate` does not touch the identity map, so re-read from the database.
        const current = await tx.findOne(ReturnRequestSchema, { id }, { refresh: true });
        if (!current) return { result: "not_found" };
        return { result: "conflict", currentStatus: toReturnStatus(current.status) };
      }

      tx.create(ReturnRequestEventSchema, {
        returnRequest: tx.getReference(ReturnRequestSchema, id),
        type: "status_changed",
        fromStatus: from,
        toStatus: to,
        note,
        actor: "agent",
      });
      await tx.flush();
      const row = await tx.findOneOrFail(ReturnRequestSchema, { id }, { refresh: true });
      return { result: "moved", request: toDomain(row) };
    }, joinOrOpen());
  }
}
