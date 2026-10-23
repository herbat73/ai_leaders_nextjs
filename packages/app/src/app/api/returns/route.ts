import { apiHandler, makeCrudRoute, parseWith, returnListQuerySchema, returnRequestCreateSchema } from "@easyrms/core";

import { resolveReturnService } from "@/server/container";

// `makeCrudRoute`'s list handler never receives the `Request`, so it cannot read `?status=`; workflow routes use `apiHandler`.
export const GET = apiHandler(async (request) => {
  const status = new URL(request.url).searchParams.get("status");
  const filter = parseWith(returnListQuerySchema, status === null ? {} : { status });
  return (await resolveReturnService()).list(filter);
});

export const { POST } = makeCrudRoute({
  resolve: resolveReturnService,
  create: { schema: returnRequestCreateSchema, handler: (service, input) => service.create(input) },
});
