import { AppError, apiHandler, clientIp, isAppError, okResponse, readCappedBytes, requireGuestSession, ValidationError } from "@easyrms/core";

import { createRequestScope } from "@/server/container";
import { readSessionToken } from "@/server/guest-session";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

/** Multipart framing around one file: boundary lines and part headers. The file itself is capped by the service's limit. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

/**
 * Customer upload of one evidence image. Guest session required (401); the order comes from the cookie. One `file`
 * part per request. This route is deliberately not in the `proxy.ts` matcher: the proxy would buffer the body up to
 * 10 MB and truncate silently beyond it, so the route caps the stream itself (413 `too_large`) before buffering.
 * 201 `{ id, byteSize, contentType }`; 400 `not_an_image`, 409 `quota_exceeded`, 422 `rejected` (infected or
 * undecodable, the message does not say which), 429 `rate_limited`, 503 `scanner_unavailable` (fail closed).
 */
export const POST = apiHandler(async (request) => {
  const scope = await createRequestScope();
  const session = await requireGuestSession(scope.cradle.guestSessionService, readSessionToken(request.headers.get("cookie")));
  const service = scope.cradle.evidenceService;

  const result = await service.upload({
    orderNumber: session.orderNumber,
    ip: clientIp(request.headers, { trustProxy: httpOptions.trustProxy() }),
    readFile: async () => {
      const contentType = request.headers.get("content-type") ?? "";
      if (!/^multipart\/form-data\s*;/i.test(contentType)) throw new ValidationError("Send the photo as multipart/form-data", { file: "required" });
      const body = await readCappedBytes(request, service.maxFileBytes + MULTIPART_OVERHEAD_BYTES).catch((error: unknown) => {
        if (isAppError(error) && error.status === 413) throw new AppError("The file is too large", 413, "too_large");
        throw error;
      });
      let form: FormData;
      try {
        form = await new Response(body as BodyInit, { headers: { "content-type": contentType } }).formData();
      } catch {
        throw new ValidationError("The upload could not be read", { file: "required" });
      }
      const parts = form.getAll("file");
      const [part] = parts;
      if (parts.length !== 1 || typeof part === "string" || part === undefined) {
        throw new ValidationError("Send exactly one file in the `file` part", { file: "required" });
      }
      return { data: new Uint8Array(await part.arrayBuffer()), name: part.name };
    },
  });
  return okResponse(result, { status: 201, headers: { "cache-control": "no-store" } });
}, httpOptions);
