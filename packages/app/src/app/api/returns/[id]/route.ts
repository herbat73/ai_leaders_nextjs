import { makeCrudRoute, returnStatusUpdateSchema } from "@easyrms/core";

import { requireAgent } from "@/server/agent-auth";
import { httpOptions } from "@/server/http-options";
import { resolveReturnService } from "@/server/container";

// Agents only: the session is checked (and the agent loaded from the database) before the body is parsed.
export const { PATCH } = makeCrudRoute({
  ...httpOptions,
  authenticate: requireAgent,
  resolve: resolveReturnService,
  patch: {
    schema: returnStatusUpdateSchema,
    handler: (service, id, input, agent) => service.transition(id, input.status, input.decisionNote, agent, input.defectConfirmed),
  },
});
