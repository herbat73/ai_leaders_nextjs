import { makeCrudRoute, supplierClaimAnswerSchema } from "@easyrms/core";

import { requireAgent } from "@/server/agent-auth";
import { resolveSupplierClaimService } from "@/server/container";
import { httpOptions } from "@/server/http-options";

// Records what the vendor answered (accepted with a credit amount, or rejected with a reason) and later that the credit
// note was booked. Any signed-in agent; the state machine and a compare-and-set settle two agents at once (409).
export const { PATCH } = makeCrudRoute({
  ...httpOptions,
  authenticate: requireAgent,
  resolve: resolveSupplierClaimService,
  patch: {
    schema: supplierClaimAnswerSchema,
    handler: (service, id, input, agent) => service.recordAnswer(id, input, agent),
  },
});
