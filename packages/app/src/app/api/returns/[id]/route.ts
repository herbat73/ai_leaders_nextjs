import { makeCrudRoute, returnStatusUpdateSchema } from "@easyrms/core";

import { httpOptions } from "@/server/http-options";
import { resolveReturnService } from "@/server/container";

export const { PATCH } = makeCrudRoute({
  ...httpOptions,
  resolve: resolveReturnService,
  patch: {
    schema: returnStatusUpdateSchema,
    handler: (service, id, input) => service.transition(id, input.status, input.decisionNote),
  },
});
