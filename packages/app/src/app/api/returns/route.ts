import {
  apiHandler,
  okResponse,
  parseJsonBody,
  parseWith,
  requireGuestSession,
  returnListQuerySchema,
  submitRequestSchema,
} from "@easyrms/core";

import { createRequestScope, resolveReturnService } from "@/server/container";
import { readSessionToken } from "@/server/guest-session";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

// `makeCrudRoute`'s list handler never receives the `Request`, so it cannot read `?status=`; workflow routes use `apiHandler`.
export const GET = apiHandler(async (request) => {
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const kind = params.get("kind");
  const filter = parseWith(returnListQuerySchema, {
    ...(status === null ? {} : { status }),
    ...(kind === null ? {} : { kind }),
  });
  return (await resolveReturnService()).list(filter);
}, httpOptions);

/**
 * Customer submission. Session required (401); the order comes from the cookie, never from the body. 201 for a new
 * request, 200 for a replay of the same `idempotencyKey`. `resolutionAmount` is `null` for `exchange`, `repair` and
 * `replacement`, else `{ amountMinor, currency, text }`. `kind: "complaint"` selects the complaint body (defect
 * description and date, serial numbers, remedy); no `kind` is a return. The legacy `orderNumber`/`customerEmail`/`reason`
 * body is a 400 `validation_error`.
 */
export const POST = apiHandler(async (request) => {
  const scope = await createRequestScope();
  const session = await requireGuestSession(
    scope.cradle.guestSessionService,
    readSessionToken(request.headers.get("cookie")),
  );
  const body = await parseJsonBody(request, submitRequestSchema(new Date()), { maxBytes: 16384 });
  const { created, ...result } = await scope.cradle.returnService.submit(session.orderNumber, body);
  return okResponse(result, { status: created ? 201 : 200, headers: { "cache-control": "no-store" } });
}, httpOptions);
