import { apiHandler, okResponse, parseJsonBody, requireGuestSession, returnSubmitSchema } from "@easyrms/core";

import { createRequestScope } from "@/server/container";
import { readSessionToken } from "@/server/guest-session";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

/**
 * Transitional twin of the final `POST /api/returns` (same body, same errors; the switch removes this route). Session
 * required (401); the order comes from the cookie, never from the body. 201 for a new request, 200 for a replay of the
 * same `idempotencyKey`. `resolutionAmount` is `null` for `exchange`, else `{ amountMinor, currency, text }`.
 */
export const POST = apiHandler(async (request) => {
  const scope = await createRequestScope();
  const session = await requireGuestSession(
    scope.cradle.guestSessionService,
    readSessionToken(request.headers.get("cookie")),
  );
  const body = await parseJsonBody(request, returnSubmitSchema, { maxBytes: 16384 });
  const { created, ...result } = await scope.cradle.returnService.submit(session.orderNumber, body);
  return okResponse(result, { status: created ? 201 : 200, headers: { "cache-control": "no-store" } });
}, httpOptions);
