import { apiHandler, okResponse } from "@easyrms/core";

import { requireAgent } from "@/server/agent-auth";
import { resolveDevResetService } from "@/server/container";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

/**
 * Development only (issue #174): empties every data table and reseeds the dev suppliers and admin. Answers 404 outside a
 * development process on a local database (the guard is `resetDevEnvironment`, not this file). `MANAGE_RULES` only: it
 * deletes every agent and every customer's data. The caller's session ends with it (the agent row is recreated under a
 * new id), so the client goes to the login page.
 */
export const POST = apiHandler(async () => {
  const result = await (await resolveDevResetService()).reset();
  return okResponse(result, { headers: { "cache-control": "no-store" } });
}, { ...httpOptions, authenticate: requireAgent, permission: "MANAGE_RULES" });
