import "server-only";

import { NotFoundError, ValidationError } from "@easyrms/core";

/** Maps domain errors to JSON responses; anything else is a 500. */
export function errorResponse(error: unknown): Response {
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message, fields: error.fields }, { status: 400 });
  }
  if (error instanceof NotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  console.error(error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
