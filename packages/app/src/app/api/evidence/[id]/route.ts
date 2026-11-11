import { EVIDENCE_EXTENSIONS, NotFoundError, NOT_FOUND_MESSAGE, apiHandler, isAppError, type EvidencePrincipal } from "@easyrms/core";

import { requireAgent } from "@/server/agent-auth";
import { createRequestScope } from "@/server/container";
import { readSessionToken } from "@/server/guest-session";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

/**
 * The one place file bytes leave the store. Allowed: a signed-in agent (any file), or the guest session of the file's
 * own order. Everything else (no cookie, another order, an unknown or deleted id) is the same 404, so a file id never
 * reveals whether it exists. Not in the `proxy.ts` matcher: guests read here too, so the checks live in this route.
 * The response cannot run script in the app origin: the type comes from the row (always a re-encoded image), `nosniff`,
 * a name built from the id (never the client's), and a sandboxing CSP.
 */
export const GET = apiHandler(async (request, { params }) => {
  const { id = "" } = await params;
  const scope = await createRequestScope();

  const agent = await requireAgent(request).catch((error: unknown) => {
    if (isAppError(error)) return null;
    throw error;
  });
  let principal: EvidencePrincipal | null = agent ? { kind: "agent" } : null;
  if (!principal) {
    const session = await scope.cradle.guestSessionService.verify(readSessionToken(request.headers.get("cookie")));
    if (session) principal = { kind: "guest", orderNumber: session.orderNumber };
  }
  if (!principal) throw new NotFoundError(NOT_FOUND_MESSAGE);

  const { file, data } = await scope.cradle.evidenceService.read(id, principal);
  return new Response(data as BodyInit, {
    status: 200,
    headers: {
      "content-type": file.contentType,
      "content-length": String(data.byteLength),
      "x-content-type-options": "nosniff",
      "content-disposition": `inline; filename="evidence-${file.id}.${EVIDENCE_EXTENSIONS[file.contentType]}"`,
      "content-security-policy": "default-src 'none'; sandbox",
      "cross-origin-resource-policy": "same-origin",
      "cache-control": "private, no-store",
    },
  });
}, httpOptions);
