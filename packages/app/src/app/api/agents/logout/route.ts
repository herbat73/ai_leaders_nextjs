import { apiHandler, okResponse } from "@easyrms/core";

import { serializeClearedAgentSessionCookie } from "@/server/agent-session";
import { requireAgent } from "@/server/agent-auth";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

/** Clears the cookie; an agent session is required (401 otherwise), repeated logouts with a valid session are idempotent. */
export const POST = apiHandler(async () => {
  return okResponse({}, { headers: { "cache-control": "no-store", "set-cookie": serializeClearedAgentSessionCookie() } });
}, { ...httpOptions, authenticate: requireAgent });
