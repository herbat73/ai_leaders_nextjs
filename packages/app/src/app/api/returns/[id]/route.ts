import { makeCrudRoute, returnStatusUpdateSchema } from "@easyrms/core";

import { resolveReturnService } from "@/server/container";

export const { PATCH } = makeCrudRoute({
  resolve: resolveReturnService,
  patch: { schema: returnStatusUpdateSchema, handler: (service, id, input) => service.updateStatus(id, input.status) },
});
