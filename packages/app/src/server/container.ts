import "server-only";

import { createContainer, InjectionMode, type AwilixContainer } from "awilix";
import { registerCore, type ReturnService } from "@easyrms/core";
import { getOrm, registerDb } from "@easyrms/db";

/** What can be resolved from a request scope. */
export interface Cradle {
  returnService: ReturnService;
}

const globalForContainer = globalThis as unknown as { __easyrmsContainer?: Promise<AwilixContainer> };

/** Composition root: the only place that wires `core` and `db` together. Built once per process. */
function getRootContainer(): Promise<AwilixContainer> {
  globalForContainer.__easyrmsContainer ??= (async () => {
    const container = createContainer({ injectionMode: InjectionMode.PROXY, strict: true });
    registerCore(container);
    registerDb(container, await getOrm());
    return container;
  })().catch((error) => {
    globalForContainer.__easyrmsContainer = undefined;
    throw error;
  });
  return globalForContainer.__easyrmsContainer;
}

/** One scope per request: scoped registrations (EntityManager fork, repositories, services) live in it. */
export async function createRequestScope(): Promise<AwilixContainer<Cradle>> {
  const root = await getRootContainer();
  return root.createScope() as AwilixContainer<Cradle>;
}

/** Resolver handed to `makeCrudRoute`: one request scope per call, returns the requested service. */
export function resolveReturnService(): Promise<ReturnService> {
  return createRequestScope().then((scope) => scope.cradle.returnService);
}
