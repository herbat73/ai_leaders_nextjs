import { apiHandler, okResponse, parseJsonBody, rulesSimulateSchema } from "@easyrms/core";

import { requireAgent } from "@/server/agent-auth";
import { resolveRulesService } from "@/server/container";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

/**
 * `MANAGE_RULES` only. A what-if: the tried R08/R09 thresholds are applied to the stored requests for this call and
 * never saved. A workflow endpoint, not CRUD, so `apiHandler` rather than `makeCrudRoute`.
 */
export const POST = apiHandler(async (request) => {
  const input = await parseJsonBody(request, rulesSimulateSchema, { maxBytes: 4096 });
  return okResponse({ simulation: await (await resolveRulesService()).simulateRules(input) }, { headers: { "cache-control": "no-store" } });
}, { ...httpOptions, authenticate: requireAgent, permission: "MANAGE_RULES" });
