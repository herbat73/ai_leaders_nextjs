import { ValidationError, type NewReturnRequest } from "@easyrms/core";

import { createRequestScope } from "@/server/container";
import { errorResponse } from "@/server/http";

export async function GET(): Promise<Response> {
  try {
    const scope = await createRequestScope();
    return Response.json(await scope.cradle.returnService.list());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json().catch(() => null);
    if (typeof body !== "object" || body === null) throw new ValidationError("Invalid JSON body");
    const scope = await createRequestScope();
    const created = await scope.cradle.returnService.create(body as NewReturnRequest);
    return Response.json(created, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
