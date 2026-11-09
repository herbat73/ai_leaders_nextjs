import { apiHandler, okResponse } from "@easyrms/core";

import { requireAgent } from "@/server/agent-auth";
import { resolveRulesService } from "@/server/container";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/** `MANAGE_RULES` only. Read-only list of the active rules (R08-R10) with their Polish description. */
export const GET = apiHandler(
  async () => okResponse({ rules: (await resolveRulesService()).listRules() }, { headers: NO_STORE }),
  { ...httpOptions, authenticate: requireAgent, permission: "MANAGE_RULES" },
);
