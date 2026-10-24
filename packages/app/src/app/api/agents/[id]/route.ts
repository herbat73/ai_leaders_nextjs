import { agentUpdateSchema, makeCrudRoute, requirePermission } from "@easyrms/core";

import { requireAgent } from "@/server/agent-auth";
import { resolveAgentService } from "@/server/container";
import { httpOptions } from "@/server/http-options";

// Agents with MANAGE_RULES only. Disabling ends the agent's sessions (epoch + 1); disabling yourself is a 409
// `self_disable`, disabling the last active manager a 409 `last_manager`.
export const { PATCH } = makeCrudRoute({
  ...httpOptions,
  authenticate: requireAgent,
  resolve: resolveAgentService,
  patch: {
    schema: agentUpdateSchema,
    handler: async (service, id, _input, agent) => {
      requirePermission(agent, "MANAGE_RULES");
      return service.disable(agent.id, id);
    },
  },
});
