import "server-only";

import { cookies } from "next/headers";
import type { AgentContext } from "@easyrms/core";

import { AGENT_SESSION_COOKIE } from "./agent-session";
import { createRequestScope } from "./container";

/**
 * The signed-in agent for the current request, or `null`. Reads the cookie, verifies signature, audience and expiry,
 * then loads the agent from the database: it must still be `active` and carry the same session epoch.
 */
export async function getCurrentAgent(): Promise<AgentContext | null> {
  const token = (await cookies()).get(AGENT_SESSION_COOKIE)?.value;
  if (!token) return null;
  const scope = await createRequestScope();
  return scope.cradle.agentService.authenticate(token);
}
