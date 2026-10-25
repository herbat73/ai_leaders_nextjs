/**
 * Creates (or re-invites) an agent with the MANAGE_RULES permission and prints a one-time invite link.
 *
 *   npm run agent:create -- --email ala@example.com --name "Ala Kowalska" [--base-url https://rms.example]
 *
 * This is how the first agent is made (nobody can sign in to invite one) and how a locked-out only manager gets back
 * in: it reuses `AgentService.invite`, so an existing invited or disabled e-mail is re-invited (password cleared,
 * sessions ended). It cannot import `src/server/container.ts` (that file imports `server-only`), so it builds a small
 * container from `registerCore` and `registerDb`. No session secret is needed: it never issues a session.
 */
import { parseArgs } from "node:util";

import { asValue, createContainer, InjectionMode } from "awilix";
import {
  agentInviteSchema,
  AgentSessionService,
  createLogMailPort,
  limitHashConcurrency,
  RateLimiter,
  registerCore,
  ScryptPasswordHasher,
  type AgentService,
} from "@easyrms/core";
import { getOrm, registerDb } from "@easyrms/db";

const USAGE = 'usage: npm run agent:create -- --email <email> --name "<display name>" [--base-url <https://host>]';
const DEFAULT_BASE_URL = "http://localhost:3000";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      "base-url": { type: "string" },
    },
    strict: true,
  });

  const parsed = agentInviteSchema.safeParse({
    email: values.email,
    displayName: values.name,
    permissions: ["MANAGE_RULES"],
  });
  if (!parsed.success) {
    console.error(`Invalid arguments: ${parsed.error.issues.map((issue) => issue.message).join("; ")}\n${USAGE}`);
    return 2;
  }
  const baseUrl = (values["base-url"] ?? DEFAULT_BASE_URL).replace(/\/+$/, "");

  const logger = {
    info: (message: string, context?: Record<string, unknown>) => console.info(message, context),
    error: (message: string, context?: Record<string, unknown>) => console.error(message, context),
  };
  const orm = await getOrm();
  try {
    const container = createContainer({ injectionMode: InjectionMode.PROXY, strict: true });
    container.register({
      logger: asValue(logger),
      mailPort: asValue(createLogMailPort({ logger })),
      passwordHasher: asValue(limitHashConcurrency(new ScryptPasswordHasher())),
      // Never used: inviting issues no session. A null secret makes any accidental use fail closed.
      agentSessionService: asValue(new AgentSessionService({ secret: null, ttlSeconds: 0, clock: () => new Date() })),
      rateLimiter: asValue(new RateLimiter({ clock: () => new Date() })),
    });
    registerCore(container);
    registerDb(container, orm);

    const agentService = container.createScope().resolve<AgentService>("agentService");
    const { agent, inviteToken } = await agentService.invite({ ...parsed.data, inviteLinkBase: `${baseUrl}/admin/invite` });

    console.log(`Agent #${agent.id} (${agent.status}) can set a password with this link (valid 72 hours, single use):`);
    console.log(`${baseUrl}/admin/invite/${inviteToken}`);
    return 0;
  } finally {
    await orm.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    // The message of an AppError is safe to show; anything else is a configuration or connection problem.
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : "Unexpected failure");
    process.exit(1);
  },
);
