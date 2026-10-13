import type { EntityManager } from "@mikro-orm/postgresql";
import {
  isReturnStatus,
  type NewReturnRequest,
  type ReturnRepository,
  type ReturnRequest,
  type ReturnStatus,
} from "@easyrms/core";

import { ReturnRequestSchema, type ReturnRequestEntity } from "../../entities";

function toDomain(entity: ReturnRequestEntity): ReturnRequest {
  return {
    id: entity.id,
    orderNumber: entity.orderNumber,
    customerEmail: entity.customerEmail,
    reason: entity.reason,
    status: isReturnStatus(entity.status) ? entity.status : "requested",
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

export class MikroOrmReturnRepository implements ReturnRepository {
  private readonly em: EntityManager;

  constructor({ em }: { em: EntityManager }) {
    this.em = em;
  }

  async list(): Promise<ReturnRequest[]> {
    const rows = await this.em.find(ReturnRequestSchema, {}, { orderBy: { createdAt: "desc", id: "desc" } });
    return rows.map(toDomain);
  }

  async findById(id: number): Promise<ReturnRequest | null> {
    const row = await this.em.findOne(ReturnRequestSchema, { id });
    return row ? toDomain(row) : null;
  }

  async create(input: NewReturnRequest): Promise<ReturnRequest> {
    const row = this.em.create(ReturnRequestSchema, { ...input, status: "requested" });
    await this.em.flush();
    return toDomain(row);
  }

  async updateStatus(id: number, status: ReturnStatus): Promise<ReturnRequest | null> {
    const row = await this.em.findOne(ReturnRequestSchema, { id });
    if (!row) return null;
    row.status = status;
    await this.em.flush();
    return toDomain(row);
  }
}
