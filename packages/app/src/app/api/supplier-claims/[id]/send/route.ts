import { apiHandler, okResponse, ValidationError } from "@easyrms/core";

import { requireAgent } from "@/server/agent-auth";
import { resolveSupplierClaimService } from "@/server/container";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

/**
 * Retries sending a `draft` claim. 409 `mail_not_configured` when the transport does not deliver, 502 `mail_failed`
 * when the mail server refuses (the claim stays a draft in both cases), 409 `conflict` when it is no longer a draft.
 */
export const POST = apiHandler(async (_request, context, agent) => {
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) throw new ValidationError("Invalid id", { id: "Must be a positive integer" });
  const result = await (await resolveSupplierClaimService()).send(id, agent);
  return okResponse(result, { headers: { "cache-control": "no-store" } });
}, { ...httpOptions, authenticate: requireAgent });
