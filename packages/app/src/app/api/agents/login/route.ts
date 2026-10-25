import { agentLoginSchema, apiHandler, clientIp, okResponse, parseJsonBody } from "@easyrms/core";

import { serializeAgentSessionCookie } from "@/server/agent-session";
import { createRequestScope } from "@/server/container";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/** Public: e-mail + password. Every failure is the same 401 `invalid_credentials`; throttled per IP and per (e-mail, IP). */
export const POST = apiHandler(async (request) => {
  const input = await parseJsonBody(request, agentLoginSchema, { maxBytes: 4096 });
  const ip = clientIp(request.headers, { trustProxy: httpOptions.trustProxy() });
  const scope = await createRequestScope();
  const { agent, sessionToken } = await scope.cradle.agentService.login({ ...input, ip });
  return okResponse(
    { displayName: agent.displayName },
    { headers: { ...NO_STORE, "set-cookie": serializeAgentSessionCookie(sessionToken) } },
  );
}, httpOptions);
