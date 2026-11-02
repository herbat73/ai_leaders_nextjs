import { agentInviteSchema, apiHandler, okResponse, parseJsonBody } from "@easyrms/core";

import { requireAgent } from "@/server/agent-auth";
import { resolveAgentService } from "@/server/container";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/** Agents with `MANAGE_RULES` only: id, e-mail, display name, status and permissions (never credentials). */
export const GET = apiHandler(async () => {
  return okResponse({ agents: await (await resolveAgentService()).list() }, { headers: NO_STORE });
}, { ...httpOptions, authenticate: requireAgent, permission: "MANAGE_RULES" });

/**
 * Agents with `MANAGE_RULES` only. Creates an invited agent or re-invites a disabled or still-invited one, and returns
 * the one-time invite token exactly once (the admin screen builds the link from its own origin). An active e-mail is a 409.
 */
export const POST = apiHandler(async (request) => {
  const input = await parseJsonBody(request, agentInviteSchema, { maxBytes: 4096 });
  // The CSRF check already proved `Origin` (when sent) names this site, so it is safe as the base of the mailed link.
  const origin = request.headers.get("origin");
  const outcome = await (await resolveAgentService()).invite({ ...input, ...(origin ? { inviteLinkBase: `${origin}/admin/invite` } : {}) });
  return okResponse(outcome, { status: 201, headers: NO_STORE });
}, { ...httpOptions, authenticate: requireAgent, permission: "MANAGE_RULES" });
