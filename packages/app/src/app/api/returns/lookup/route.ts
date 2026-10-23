import { apiHandler, clientIp, okResponse, parseJsonBody, returnLookupSchema } from "@easyrms/core";

import { createRequestScope } from "@/server/container";
import { serializeSessionCookie } from "@/server/guest-session";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/** Public: order number + e-mail. The cookie is set only when the order is delivered and found (200 with lines). */
export const POST = apiHandler(async (request) => {
  const input = await parseJsonBody(request, returnLookupSchema, { maxBytes: 4096 });
  const ip = clientIp(request.headers, { trustProxy: httpOptions.trustProxy() });
  const scope = await createRequestScope();
  const { view, sessionToken } = await scope.cradle.returnLookupService.lookup({ ...input, ip });
  const headers: Record<string, string> = sessionToken
    ? { ...NO_STORE, "set-cookie": serializeSessionCookie(sessionToken) }
    : NO_STORE;
  return okResponse(view, { headers });
}, httpOptions);
