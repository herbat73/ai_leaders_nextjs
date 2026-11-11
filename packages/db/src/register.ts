import { asClass, asFunction, asValue, type AwilixContainer } from "awilix";
import type { EntityManager, MikroORM } from "@mikro-orm/postgresql";

import { MikroOrmAgentRepository } from "./repositories/agents/agent.repository";
import { PostgresRateLimiter } from "./repositories/security/postgres-rate-limiter";
import { MikroOrmEvidenceRepository } from "./repositories/evidence/evidence.repository";
import { MikroOrmRetentionRepository } from "./repositories/retention/retention.repository";
import { MikroOrmReturnRepository } from "./repositories/returns/return.repository";
import { MikroOrmSupplierClaimRepository } from "./repositories/supplier-claims/supplier-claim.repository";
import { MikroOrmSupplierRepository } from "./repositories/suppliers/supplier.repository";

/**
 * Registers persistence. `orm` is a singleton (one pool); `em` is a fork per scope,
 * so every request gets its own identity map.
 */
export function registerDb(container: AwilixContainer, orm: MikroORM): void {
  container.register({
    orm: asValue(orm),
    em: asFunction(({ orm }: { orm: MikroORM }): EntityManager => orm.em.fork() as EntityManager).scoped(),
    // One limiter per process; the budgets live in Postgres, so a restart or a second instance shares them.
    rateLimiter: asFunction(({ orm }: { orm: MikroORM }) => new PostgresRateLimiter({ orm, clock: () => new Date() })).singleton(),
    evidencePort: asClass(MikroOrmEvidenceRepository).scoped(),
    retentionPort: asClass(MikroOrmRetentionRepository).scoped(),
    returnRepository: asClass(MikroOrmReturnRepository).scoped(),
    agentRepository: asClass(MikroOrmAgentRepository).scoped(),
    supplierRepository: asClass(MikroOrmSupplierRepository).scoped(),
    supplierClaimRepository: asClass(MikroOrmSupplierClaimRepository).scoped(),
  });
}
