import { UniqueConstraintViolationException } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import { ConflictError, type NewSupplier, type Supplier, type SupplierChanges, type SupplierRepository } from "@easyrms/core";

import { SupplierSchema, type SupplierEntity } from "../../entities";

const NAME_INDEX = "suppliers_name_lower_unique";

const toDomain = (entity: SupplierEntity): Supplier => ({
  id: entity.id,
  name: entity.name,
  email: entity.email,
  guidelines: entity.guidelines ?? null,
  active: entity.active,
  createdAt: entity.createdAt,
  updatedAt: entity.updatedAt,
});

function asConflict(error: unknown): unknown {
  if (error instanceof UniqueConstraintViolationException && error.message.includes(NAME_INDEX)) {
    return new ConflictError("A supplier with this name already exists", { name: "exists" });
  }
  return error;
}

export class MikroOrmSupplierRepository implements SupplierRepository {
  private readonly em: EntityManager;

  constructor({ em }: { em: EntityManager }) {
    this.em = em;
  }

  async list(): Promise<Supplier[]> {
    const rows = await this.em.find(SupplierSchema, {}, { orderBy: { active: "desc", name: "asc" } });
    return rows.map(toDomain);
  }

  async findById(id: number): Promise<Supplier | null> {
    const row = await this.em.findOne(SupplierSchema, { id }, { refresh: true });
    return row ? toDomain(row) : null;
  }

  async create(input: NewSupplier): Promise<Supplier> {
    const row = this.em.create(SupplierSchema, { name: input.name, email: input.email, guidelines: input.guidelines, active: true });
    try {
      await this.em.flush();
    } catch (error) {
      throw asConflict(error);
    }
    return toDomain(row);
  }

  async update(id: number, changes: SupplierChanges): Promise<Supplier | null> {
    const row = await this.em.findOne(SupplierSchema, { id }, { refresh: true });
    if (!row) return null;
    this.em.assign(row, changes);
    try {
      await this.em.flush();
    } catch (error) {
      throw asConflict(error);
    }
    return toDomain(row);
  }
}
