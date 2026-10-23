import { TransactionPropagation, UniqueConstraintViolationException } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import {
  DECISION_STATUSES,
  formatRma,
  RETURN_KIND,
  RETURN_STATUSES,
  toReturnStatus,
  type ApiLogger,
  ConflictError,
  money,
  parseMoney,
  RETURN_METHODS,
  RETURN_REASON_CODES,
  RETURN_RESOLUTIONS,
  type LegacyNewReturnRequest,
  type Money,
  type NewReturnRequest,
  type ReturnDetail,
  type ReturnEvent,
  type ReturnItem,
  type ReturnListFilter,
  type ReturnRepository,
  type ReturnRequest,
  type ReturnStatus,
  type StoredReturnStatus,
  type TransitionOutcome,
} from "@easyrms/core";

import {
  ReturnRequestEventSchema,
  ReturnRequestItemSchema,
  ReturnRequestSchema,
  type ReturnRequestEntity,
  type ReturnRequestEventEntity,
  type ReturnRequestItemEntity,
} from "../../entities";

/**
 * Joins the caller's transaction when there is one, otherwise opens its own (the default, NESTED, is a savepoint).
 * A fresh object per call: `em.transactional` writes `ctx` into the options it is given, so a shared constant would
 * carry the first caller's transaction into every later call.
 */
const joinOrOpen = (): { propagation: TransactionPropagation } => ({ propagation: TransactionPropagation.REQUIRED });

/** Statuses that release the quantity a request held (S7). */
const RELEASING_STATUSES = ["cancelled", "rejected"];

const IDEMPOTENCY_CONSTRAINT = "return_requests_idempotency_key_unique";

/** Integer grosze to the `numeric(12,2)` text form, without a float round trip. */
function toDecimal(m: Money): string {
  const abs = Math.abs(m.amountMinor);
  return `${m.amountMinor < 0 ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Stored decimals are written by this repository only, so they always parse. */
function fromDecimal(value: string | number): Money {
  return parseMoney(String(value)) ?? money(0);
}

/** Narrows a stored string to a union of the domain; an unrecognised value (hand edit) becomes `null` (unknown). */
function oneOf<T extends string>(values: readonly T[], value: string | null | undefined): T | null {
  return values.find((candidate) => candidate === value) ?? null;
}

function toItem(entity: ReturnRequestItemEntity): ReturnItem {
  return {
    lineRef: entity.lineRef,
    sku: entity.sku,
    name: entity.name,
    quantity: entity.quantity,
    unitPrice: fromDecimal(entity.unitPrice),
    // Written only by this repository from the domain union.
    reasonCode: oneOf(RETURN_REASON_CODES, entity.reasonCode) ?? "other",
    comment: entity.comment ?? null,
  };
}

function toDomain(entity: ReturnRequestEntity): ReturnRequest {
  return {
    id: entity.id,
    rma: entity.rma,
    // `kind` is a column for later specs; only "return" exists today.
    kind: RETURN_KIND,
    orderNumber: entity.orderNumber,
    customerEmail: entity.customerEmail,
    reason: entity.reason ?? null,
    status: toReturnStatus(entity.status),
    hasDecisionNote: Boolean(entity.decisionNote),
    resolution: oneOf(RETURN_RESOLUTIONS, entity.resolution),
    resolutionAmount: entity.resolutionAmount === null || entity.resolutionAmount === undefined ? null : fromDecimal(entity.resolutionAmount),
    returnMethod: oneOf(RETURN_METHODS, entity.returnMethod),
    exchangeNote: entity.exchangeNote ?? null,
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
    return row ? this.toDetail(row) : null;
  }

  async findByRma(rma: string): Promise<ReturnDetail | null> {
    const row = await this.em.findOne(ReturnRequestSchema, { rma }, { refresh: true });
    return row ? this.toDetail(row) : null;
  }

  async listByOrder(orderNumber: string): Promise<ReturnRequest[]> {
    const rows = await this.em.find(ReturnRequestSchema, { orderNumber }, { orderBy: { createdAt: "desc", id: "desc" } });
    return rows.map(toDomain);
  }

  async findByIdempotencyKey(key: string): Promise<ReturnRequest | null> {
    const row = await this.em.findOne(ReturnRequestSchema, { idempotencyKey: key }, { refresh: true });
    return row ? toDomain(row) : null;
  }

  async claimedQuantities(orderNumber: string): Promise<Record<string, number>> {
    const items = await this.em.find(
      ReturnRequestItemSchema,
      { returnRequest: { orderNumber, status: { $nin: RELEASING_STATUSES } } },
      { refresh: true },
    );
    const claimed: Record<string, number> = {};
    for (const item of items) claimed[item.lineRef] = (claimed[item.lineRef] ?? 0) + item.quantity;
    return claimed;
  }

  withOrderLock<T>(orderNumber: string, fn: (tx: ReturnRepository) => Promise<T>): Promise<T> {
    return this.em.transactional(async (tx) => {
      // Raw SQL: MikroORM has no advisory-lock API. The order number is a bound parameter, never concatenated; the lock
      // is released when the transaction ends, so submits for one order queue here and other orders are unaffected.
      await tx.execute("select pg_advisory_xact_lock(hashtext(?))", [orderNumber]);
      return fn(new MikroOrmReturnRepository({ em: tx, logger: this.logger }));
    }, joinOrOpen());
  }

  private async toDetail(row: ReturnRequestEntity): Promise<ReturnDetail> {
    const events = await this.em.find(
      ReturnRequestEventSchema,
      { returnRequest: row.id },
      { orderBy: { createdAt: "asc", id: "asc" } },
    );
    const items = await this.em.find(ReturnRequestItemSchema, { returnRequest: row.id }, { orderBy: { id: "asc" } });
    return {
      request: toDomain(row),
      decisionNote: row.decisionNote ?? null,
      items: items.map(toItem),
      events: events.map(toEvent),
    };
  }

  async findStatus(id: number): Promise<StoredReturnStatus | null> {
    const row = await this.em.findOne(ReturnRequestSchema, { id }, { fields: ["status"], refresh: true });
    return row ? toReturnStatus(row.status) : null;
  }

  create(input: LegacyNewReturnRequest): Promise<ReturnRequest> {
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

  async createWithItems(input: NewReturnRequest): Promise<ReturnRequest> {
    try {
      return await this.em.transactional(async (tx) => {
        const [{ seq }] = await tx.execute<{ seq: string }[]>(`select nextval('return_rma_seq') as "seq"`);
        const createdAt = new Date();
        const row = tx.create(ReturnRequestSchema, {
          orderNumber: input.orderNumber,
          customerEmail: input.customerEmail,
          rma: formatRma(Number(seq), createdAt),
          kind: RETURN_KIND,
          status: "submitted",
          resolution: input.resolution,
          resolutionAmount: input.resolutionAmount ? toDecimal(input.resolutionAmount) : null,
          exchangeNote: input.exchangeNote ?? null,
          returnMethod: input.returnMethod,
          idempotencyKey: input.idempotencyKey,
          createdAt,
          updatedAt: createdAt,
        });
        for (const item of input.items) {
          tx.create(ReturnRequestItemSchema, {
            returnRequest: row,
            lineRef: item.lineRef,
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            unitPrice: toDecimal(item.unitPrice),
            reasonCode: item.reasonCode,
            comment: item.comment ?? null,
          });
        }
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
    } catch (error) {
      // Two different orders can reuse one key (they take different locks), so the unique index is the last guard.
      if (error instanceof UniqueConstraintViolationException && error.message.includes(IDEMPOTENCY_CONSTRAINT)) {
        throw new ConflictError("This idempotency key was already used");
      }
      throw error;
    }
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
