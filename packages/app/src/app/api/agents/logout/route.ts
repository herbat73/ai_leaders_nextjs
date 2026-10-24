import { apiHandler, okResponse } from "@easyrms/core";

import { serializeClearedAgentSessionCookie } from "@/server/agent-session";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

/** Clears the cookie; idempotent (also answers 200 when there was no session). */
export const POST = apiHandler(async () => {
  return okResponse({}, { headers: { "cache-control": "no-store", "set-cookie": serializeClearedAgentSessionCookie() } });
}, httpOptions);
