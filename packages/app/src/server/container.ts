import "server-only";

import { asFunction, asValue, createContainer, InjectionMode, type AwilixContainer } from "awilix";
import {
  createFakeOrderLookup,
  createLogMailPort,
  limitHashConcurrency,
  ScryptPasswordHasher,
  RateLimiter,
  registerCore,
  selectOrderSource,
  withLookupTimeout,
  type AgentService,
  type AgentSessionService,
  type ApiLogger,
  type CaseSampleService,
  type MailLogger,
  type GuestSessionService,
  type MailPort,
  type OrderLookup,
  type PasswordHasher,
  type ReturnLookupService,
  type ReturnService,
} from "@easyrms/core";
import { getOrm, registerDb } from "@easyrms/db";

import { getAgentSessionService } from "./agent-session";
import { getGuestSessionService } from "./guest-session";
import { getEligibilityConfig, getQuoteConfig } from "./return-config";

/** What can be resolved from a request scope. */
export interface Cradle {
  agentService: AgentService;
  agentSessionService: AgentSessionService;
  caseSampleService: CaseSampleService;
  guestSessionService: GuestSessionService;
  logger: ApiLogger;
  mailPort: MailPort;
  orderLookup: OrderLookup;
  passwordHasher: PasswordHasher;
  returnLookupService: ReturnLookupService;
  returnService: ReturnService;
}

const logger: ApiLogger & MailLogger = {
  info: (message, context) => console.info(message, context),
  error: (message, context) => console.error(message, context),
};

const globalForLimiter = globalThis as unknown as { __easyrmsRateLimiter?: RateLimiter };

/** One limiter per process, shared by every route bundle and HMR reload (like the container). */
function getRateLimiter(): RateLimiter {
  globalForLimiter.__easyrmsRateLimiter ??= new RateLimiter({ clock: () => new Date() });
  return globalForLimiter.__easyrmsRateLimiter;
}

/**
 * The order adapter, chosen on first resolve and never at import, so `next build` needs no configuration and
 * production fails closed (opaque 500) on the first customer request.
 */
function createOrderLookup(): OrderLookup {
  const source = selectOrderSource({ nodeEnv: process.env.NODE_ENV, source: process.env.EASYRMS_ORDER_SOURCE });
  switch (source) {
    case "fake":
      return withLookupTimeout(createFakeOrderLookup());
  }
}

const globalForContainer = globalThis as unknown as { __easyrmsContainer?: Promise<AwilixContainer> };

/** Composition root: the only place that wires `core` and `db` together. Built once per process. */
function getRootContainer(): Promise<AwilixContainer> {
  globalForContainer.__easyrmsContainer ??= (async () => {
    const container = createContainer({ injectionMode: InjectionMode.PROXY, strict: true });
    container.register({
      logger: asValue(logger),
      mailPort: asFunction(createLogMailPort).singleton(),
      orderLookup: asFunction(createOrderLookup).singleton(),
      guestSessionService: asFunction(getGuestSessionService).singleton(),
      agentSessionService: asFunction(getAgentSessionService).singleton(),
      // One hasher (and so one concurrency cap) per process.
      passwordHasher: asFunction(() => limitHashConcurrency(new ScryptPasswordHasher())).singleton(),
      rateLimiter: asFunction(getRateLimiter).singleton(),
      eligibilityConfig: asFunction(getEligibilityConfig).singleton(),
      quoteConfig: asFunction(getQuoteConfig).singleton(),
    });
    registerCore(container);
    registerDb(container, await getOrm());
    return container;
  })().catch((error) => {
    globalForContainer.__easyrmsContainer = undefined;
    throw error;
  });
  return globalForContainer.__easyrmsContainer;
}

const globalForCoreContainer = globalThis as unknown as { __easyrmsCoreContainer?: AwilixContainer };

/**
 * A container with `registerCore` only: no `getOrm()`, so stateless features (the case sample lab) work without
 * Postgres. Never resolve scoped registrations (`returnService` and friends) from it.
 */
function getCoreContainer(): AwilixContainer {
  if (!globalForCoreContainer.__easyrmsCoreContainer) {
    const container = createContainer({ injectionMode: InjectionMode.PROXY, strict: true });
    container.register({ logger: asValue(logger) });
    registerCore(container);
    globalForCoreContainer.__easyrmsCoreContainer = container;
  }
  return globalForCoreContainer.__easyrmsCoreContainer;
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

/** Resolver for agent management routes: one request scope per call. */
export function resolveAgentService(): Promise<AgentService> {
  return createRequestScope().then((scope) => scope.cradle.agentService);
}

/** Resolved from the core-only container, so it never builds the ORM. */
export function resolveCaseSampleService(): CaseSampleService {
  return (getCoreContainer() as AwilixContainer<Cradle>).cradle.caseSampleService;
}
