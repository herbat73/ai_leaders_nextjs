import { makeCrudRoute, returnRequestCreateSchema } from "@easyrms/core";

import { resolveReturnService } from "@/server/container";

export const { GET, POST } = makeCrudRoute({
  resolve: resolveReturnService,
  list: (service) => service.list(),
  create: { schema: returnRequestCreateSchema, handler: (service, input) => service.create(input) },
});
