import { isReturnStatus, ValidationError } from "@easyrms/core";

import { createRequestScope } from "@/server/container";
import { errorResponse } from "@/server/http";

export async function PATCH(request: Request, ctx: RouteContext<"/api/returns/[id]">): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const returnId = Number(id);
    if (!Number.isInteger(returnId)) throw new ValidationError("Invalid id", { id: "Must be an integer" });
    const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
    if (!isReturnStatus(body?.status)) throw new ValidationError("Invalid status", { status: "Unknown status" });
    const scope = await createRequestScope();
    return Response.json(await scope.cradle.returnService.updateStatus(returnId, body.status));
  } catch (error) {
    return errorResponse(error);
  }
}
