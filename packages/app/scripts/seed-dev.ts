/**
 * Seeds the local development database with two suppliers and an initial administrator (issue #156).
 *
 *   npm run seed:dev
 *
 * Safe to rerun: what already exists is left as it is. Refuses when `NODE_ENV` is `production`: the admin's password is
 * public (see `src/server/dev-seed.ts`). `npm run setup` runs it once for a fresh checkout. Like `agent-create.ts` it
 * cannot import `src/server/container.ts` (that file imports `server-only`), so it builds a small container.
 */
import { asValue, createContainer, InjectionMode } from "awilix";
import {
  AgentSessionService,
  createLogMailPort,
  limitHashConcurrency,
  parseManagerInviteTtl,
  registerCore,
  ScryptPasswordHasher,
  type AgentRepository,
  type AgentService,
  type PasswordHasher,
  type SupplierService,
} from "@easyrms/core";
import { getOrm, registerDb } from "@easyrms/db";

import { DEV_SEED_ADMIN, DevSeedRefusedError, seedDevData } from "../src/server/dev-seed";

async function main(): Promise<number> {
  // Fail before opening a database connection.
  if (process.env.NODE_ENV === "production") throw new DevSeedRefusedError();

  const logger = {
    info: (message: string, context?: Record<string, unknown>) => console.info(message, context),
    error: (message: string, context?: Record<string, unknown>) => console.error(message, context),
  };
  const orm = await getOrm();
  try {
    const container = createContainer({ injectionMode: InjectionMode.PROXY, strict: true });
    const passwordHasher = limitHashConcurrency(new ScryptPasswordHasher());
    container.register({
      logger: asValue(logger),
      // The seeded admin gets no invite mail: the invite is consumed in the same run.
      mailPort: asValue(createLogMailPort({ logger })),
      passwordHasher: asValue(passwordHasher),
      inviteConfig: asValue(parseManagerInviteTtl(process.env.EASYRMS_MANAGER_INVITE_TTL_HOURS)),
      // Never used: no session is issued. A null secret makes any accidental use fail closed.
      agentSessionService: asValue(new AgentSessionService({ secret: null, ttlSeconds: 0, clock: () => new Date() })),
    });
    registerCore(container);
    registerDb(container, orm);

    const scope = container.createScope();
    const result = await seedDevData({
      supplierService: scope.resolve<SupplierService>("supplierService"),
      agentService: scope.resolve<AgentService>("agentService"),
      agentRepository: scope.resolve<AgentRepository>("agentRepository"),
      passwordHasher: scope.resolve<PasswordHasher>("passwordHasher"),
      clock: () => new Date(),
      nodeEnv: process.env.NODE_ENV,
    });

    for (const name of result.suppliersCreated) console.log(`✔ supplier created: ${name}`);
    for (const name of result.suppliersKept) console.log(`↷ supplier exists, left as is: ${name}`);
    console.log(
      result.adminCreated
        ? `✔ admin created: ${DEV_SEED_ADMIN.email} (password in packages/app/src/server/dev-seed.ts; local development only)`
        : `↷ agent ${DEV_SEED_ADMIN.email} exists, left as is`,
    );
    return 0;
  } finally {
    await orm.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    // The message of an AppError or a refusal is safe to show; anything else is a configuration or connection problem.
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : "Unexpected failure");
    process.exit(1);
  },
);
