import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UnauthorizedError, sanitizeAdminNext, type AgentContext } from "@easyrms/core";

import { AGENT_SESSION_COOKIE, readAgentSessionToken } from "./agent-session";
import { createRequestScope } from "./container";

export { requirePermission } from "@easyrms/core";

async function authenticate(token: string | null | undefined): Promise<AgentContext | null> {
  if (!token) return null;
  const scope = await createRequestScope();
  return scope.cradle.agentService.authenticate(token);
}

/**
 * The signed-in agent for the current request, or `null`. Reads the cookie, verifies signature, audience and expiry,
 * then loads the agent from the database: it must still be `active` and carry the same session epoch, so disabling
 * an agent takes effect on the next request.
 */
export async function getCurrentAgent(): Promise<AgentContext | null> {
  return authenticate((await cookies()).get(AGENT_SESSION_COOKIE)?.value);
}

/** For API routes (`authenticate` option of `apiHandler`): the agent, or `UnauthorizedError` (401). */
export async function requireAgent(request: Request): Promise<AgentContext> {
  const agent = await authenticate(readAgentSessionToken(request.headers.get("cookie")));
  if (!agent) throw new UnauthorizedError();
  return agent;
}

/**
 * For admin pages: the agent, or a redirect to the login page that returns to `path`. Every admin page calls this
 * itself, because a layout is not re-run on client navigations. The returned agent also feeds the page chrome
 * (`AdminShell`), so a page that forgets the call visibly lacks its header.
 */
export async function requireAgentPage(path: string): Promise<AgentContext> {
  const agent = await getCurrentAgent();
  if (!agent) redirect(`/admin/login?next=${encodeURIComponent(sanitizeAdminNext(path, "/admin/returns"))}`);
  return agent;
}
