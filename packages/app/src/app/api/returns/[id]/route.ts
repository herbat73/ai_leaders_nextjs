import { ANY_AGENT, makeCrudRoute, returnStatusUpdateSchema } from "@easyrms/core";

import { requireAgent } from "@/server/agent-auth";
import { httpOptions } from "@/server/http-options";
import { resolveReturnService } from "@/server/container";

// Any signed-in agent; approving a refund above the limit needs MANAGE_RULES, which `ReturnService.transition` checks
// (403 `approval_required`) because it depends on the amount. The session is checked (and the agent loaded from the database) before the body is parsed.
export const { PATCH } = makeCrudRoute({
  ...httpOptions,
  authenticate: requireAgent,
  permission: ANY_AGENT,
  resolve: resolveReturnService,
  patch: {
    schema: returnStatusUpdateSchema,
    handler: (service, id, input, agent) => service.transition(id, input.status, input.decisionNote, agent, input.defectConfirmed),
  },
});
