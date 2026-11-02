import { apiHandler, okResponse } from "@easyrms/core";

import { serializeClearedAgentSessionCookie } from "@/server/agent-session";
import { requireAgent } from "@/server/agent-auth";
import { resolveAgentService } from "@/server/container";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

/**
 * Ends the agent's sessions and clears the cookie. The session epoch moves on, so a copied token is rejected at once
 * and the agent is signed out on every device too. A session is required (401 otherwise): replaying the old cookie
 * after a logout is a 401, not a second logout.
 */
export const POST = apiHandler(async (_request, _context, agent) => {
  await (await resolveAgentService()).logout(agent.id);
  return okResponse({}, { headers: { "cache-control": "no-store", "set-cookie": serializeClearedAgentSessionCookie() } });
}, { ...httpOptions, authenticate: requireAgent });
