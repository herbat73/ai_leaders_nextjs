import { agentInviteAcceptSchema, apiHandler, clientIp, okResponse, parseJsonBody } from "@easyrms/core";

import { serializeAgentSessionCookie } from "@/server/agent-session";
import { createRequestScope } from "@/server/container";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/** Public: the one-time token and the new password. Unknown, expired and used tokens all answer 400 `invite_invalid`; throttled per IP (429). */
export const POST = apiHandler(async (request) => {
  const input = await parseJsonBody(request, agentInviteAcceptSchema, { maxBytes: 4096 });
  const ip = clientIp(request.headers, { trustProxy: httpOptions.trustProxy() });
  const scope = await createRequestScope();
  const { agent, sessionToken } = await scope.cradle.agentService.acceptInvite({ ...input, ip });
  return okResponse(
    { displayName: agent.displayName },
    { headers: { ...NO_STORE, "set-cookie": serializeAgentSessionCookie(sessionToken) } },
  );
}, httpOptions);
