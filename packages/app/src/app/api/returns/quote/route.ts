import { apiHandler, okResponse, parseJsonBody, requireGuestSession, returnQuoteSchema } from "@easyrms/core";

import { createRequestScope } from "@/server/container";
import { readSessionToken } from "@/server/guest-session";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

/** Session required (401 `unauthorized`); the order comes from the cookie, never from the body. */
export const POST = apiHandler(async (request) => {
  const scope = await createRequestScope();
  const session = await requireGuestSession(
    scope.cradle.guestSessionService,
    readSessionToken(request.headers.get("cookie")),
  );
  const body = await parseJsonBody(request, returnQuoteSchema, { maxBytes: 8192 });
  const quote = await scope.cradle.returnLookupService.quote({ sessionOrderNumber: session.orderNumber, ...body });
  return okResponse(quote, { headers: { "cache-control": "no-store" } });
}, httpOptions);
