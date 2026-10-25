import { TransactionPropagation, UniqueConstraintViolationException } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import {
  AppError,
  formatClaimRef,
  SUPPLIER_CLAIM_STATUSES,
  type NewSupplierClaim,
  type StoredSupplierClaimStatus,
  type SupplierClaim,
  type SupplierClaimAnswer,
  type SupplierClaimEvent,
  type SupplierClaimRepository,
  type SupplierClaimStatus,
  type SupplierClaimTransitionOutcome,
  type SupplierClaimView,
} from "@easyrms/core";

import { fromDecimal, toDecimal } from "../../decimal";
import {
  AgentSchema,
  ReturnRequestSchema,
  SupplierClaimEventSchema,
  SupplierClaimSchema,
  SupplierSchema,
  type SupplierClaimEntity,
  type SupplierClaimEventEntity,
} from "../../entities";

const RETURN_REQUEST_CONSTRAINT = "supplier_claims_return_request_id_unique";

const joinOrOpen = (): { propagation: TransactionPropagation } => ({ propagation: TransactionPropagation.REQUIRED });

const toStatus = (value: string): StoredSupplierClaimStatus => SUPPLIER_CLAIM_STATUSES.find((status) => status === value) ?? "unknown";

function toDomain(entity: SupplierClaimEntity): SupplierClaim {
  return {
    id: entity.id,
    ref: entity.ref,
    returnRequestId: entity.returnRequest.id,
    supplierId: entity.supplier.id,
    status: toStatus(entity.status),
    subject: entity.subject,
    body: entity.body,
    createdByAgentId: entity.createdByAgent.id,
    sentAt: entity.sentAt ?? null,
    answeredAt: entity.answeredAt ?? null,
    creditAmount: entity.creditAmount === null || entity.creditAmount === undefined ? null : fromDecimal(entity.creditAmount),
    answerNote: entity.answerNote ?? null,
    creditedAt: entity.creditedAt ?? null,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

type ViewWithoutTransitions = Omit<SupplierClaimView, "allowedTransitions">;

function toView(entity: SupplierClaimEntity): ViewWithoutTransitions {
  return {
    ...toDomain(entity),
    supplierName: entity.supplier.name,
    supplierEmail: entity.supplier.email,
    rma: entity.returnRequest.rma,
  };
}

function toEvent(entity: SupplierClaimEventEntity): SupplierClaimEvent {
  return {
    id: entity.id,
    type: entity.type as SupplierClaimEvent["type"],
    fromStatus: entity.fromStatus ? toStatus(entity.fromStatus) : null,
    toStatus: toStatus(entity.toStatus),
    note: entity.note ?? null,
    agentId: entity.agent?.id ?? null,
    agentName: entity.agent?.displayName ?? null,
    createdAt: entity.createdAt,
  };
}

export class MikroOrmSupplierClaimRepository implements SupplierClaimRepository {
  private readonly em: EntityManager;

  constructor({ em }: { em: EntityManager }) {
    this.em = em;
  }

  async create(input: NewSupplierClaim): Promise<SupplierClaim> {
    try {
      return await this.em.transactional(async (tx) => {
        const [{ seq }] = await tx.execute<{ seq: string }[]>(`select nextval('supplier_claim_seq') as "seq"`);
        const createdAt = new Date();
        const claim = tx.create(SupplierClaimSchema, {
          ref: formatClaimRef(Number(seq), createdAt),
          returnRequest: tx.getReference(ReturnRequestSchema, input.returnRequestId),
          supplier: tx.getReference(SupplierSchema, input.supplierId),
          status: "draft",
          subject: input.subject,
          body: input.body,
          createdByAgent: tx.getReference(AgentSchema, input.agentId),
          createdAt,
          updatedAt: createdAt,
        });
        tx.create(SupplierClaimEventSchema, {
          supplierClaim: claim,
          type: "created",
          fromStatus: null,
          toStatus: "draft",
          note: null,
          agent: tx.getReference(AgentSchema, input.agentId),
          createdAt,
        });
        await tx.flush();
        return toDomain(claim);
      }, joinOrOpen());
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException && error.message.includes(RETURN_REQUEST_CONSTRAINT)) {
        throw new AppError("A claim for this complaint already exists", 409, "claim_exists");
      }
      throw error;
    }
  }

  async findById(id: number): Promise<SupplierClaim | null> {
    const row = await this.em.findOne(SupplierClaimSchema, { id }, { refresh: true });
    return row ? toDomain(row) : null;
  }

  async findByReturnRequest(returnRequestId: number): Promise<SupplierClaim | null> {
    const row = await this.em.findOne(SupplierClaimSchema, { returnRequest: returnRequestId }, { refresh: true });
    return row ? toDomain(row) : null;
  }

  async list(filter: { status?: StoredSupplierClaimStatus } = {}): Promise<ViewWithoutTransitions[]> {
    const where =
      filter.status === undefined
        ? {}
        : filter.status === "unknown"
          ? { status: { $nin: [...SUPPLIER_CLAIM_STATUSES] } }
          : { status: filter.status };
    const rows = await this.em.find(SupplierClaimSchema, where, {
      populate: ["supplier", "returnRequest"],
      orderBy: { createdAt: "desc", id: "desc" },
    });
    return rows.map(toView);
  }

  async findDetail(id: number): Promise<{ claim: ViewWithoutTransitions; events: SupplierClaimEvent[] } | null> {
    const row = await this.em.findOne(SupplierClaimSchema, { id }, { populate: ["supplier", "returnRequest"], refresh: true });
    if (!row) return null;
    const events = await this.em.find(
      SupplierClaimEventSchema,
      { supplierClaim: row.id },
      { populate: ["agent"], orderBy: { createdAt: "asc", id: "asc" }, refresh: true },
    );
    return { claim: toView(row), events: events.map(toEvent) };
  }

  transition(
    id: number,
    from: SupplierClaimStatus,
    to: SupplierClaimStatus,
    agentId: number,
    answer?: SupplierClaimAnswer,
  ): Promise<SupplierClaimTransitionOutcome> {
    // Runs on the callback's EntityManager: `this.em` is a plain fork and would run outside the transaction.
    return this.em.transactional(async (tx): Promise<SupplierClaimTransitionOutcome> => {
      const now = new Date();
      // `nativeUpdate` skips the `onUpdate` hook, so `updatedAt` is set here.
      const data = {
        status: to,
        updatedAt: now,
        ...(to === "sent" ? { sentAt: now } : {}),
        ...(to === "accepted" || to === "rejected"
          ? {
              answeredAt: now,
              answerNote: answer?.note ?? null,
              ...(to === "accepted" && answer?.creditAmount ? { creditAmount: toDecimal(answer.creditAmount) } : {}),
            }
          : {}),
        ...(to === "credited" ? { creditedAt: now } : {}),
      };
      const updated = await tx.nativeUpdate(SupplierClaimSchema, { id, status: from }, data);

      if (updated === 0) {
        const current = await tx.findOne(SupplierClaimSchema, { id }, { refresh: true });
        if (!current) return { result: "not_found" };
        return { result: "conflict", currentStatus: toStatus(current.status) };
      }

      tx.create(SupplierClaimEventSchema, {
        supplierClaim: tx.getReference(SupplierClaimSchema, id),
        type: "status_changed",
        fromStatus: from,
        toStatus: to,
        note: answer?.note ?? null,
        agent: tx.getReference(AgentSchema, agentId),
      });
      await tx.flush();
      const row = await tx.findOneOrFail(SupplierClaimSchema, { id }, { refresh: true });
      return { result: "moved", claim: toDomain(row) };
    }, joinOrOpen());
  }
}
