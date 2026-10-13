import { asClass, asFunction, asValue, type AwilixContainer } from "awilix";
import type { EntityManager, MikroORM } from "@mikro-orm/postgresql";

import { MikroOrmReturnRepository } from "./repositories/returns/return.repository";

/**
 * Registers persistence. `orm` is a singleton (one pool); `em` is a fork per scope,
 * so every request gets its own identity map.
 */
export function registerDb(container: AwilixContainer, orm: MikroORM): void {
  container.register({
    orm: asValue(orm),
    em: asFunction(({ orm }: { orm: MikroORM }): EntityManager => orm.em.fork() as EntityManager).scoped(),
    returnRepository: asClass(MikroOrmReturnRepository).scoped(),
  });
}
