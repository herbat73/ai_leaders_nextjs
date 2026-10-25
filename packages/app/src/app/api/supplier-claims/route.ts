import { apiHandler, okResponse, parseJsonBody, parseWith, supplierClaimCreateSchema, supplierClaimListQuerySchema } from "@easyrms/core";

import { requireAgent } from "@/server/agent-auth";
import { resolveSupplierClaimService } from "@/server/container";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/** Every signed-in agent. `?status=` narrows the list; newest first, with the vendor's name and the complaint's RMA. */
export const GET = apiHandler(async (request) => {
  const status = new URL(request.url).searchParams.get("status");
  const filter = parseWith(supplierClaimListQuerySchema, status === null ? {} : { status });
  return okResponse({ claims: await (await resolveSupplierClaimService()).list(filter) }, { headers: NO_STORE });
}, { ...httpOptions, authenticate: requireAgent });

/**
 * Creates the claim for a complaint with a confirmed defect and tries to send it in the same call: 201 with
 * `{ claim, delivery }`, where `delivery` is `sent`, `not_configured` (the mail transport does not deliver) or `failed`
 * (the claim stays a draft either way and can be retried). 409 `claim_exists` for a second claim.
 */
export const POST = apiHandler(async (request, _context, agent) => {
  const input = await parseJsonBody(request, supplierClaimCreateSchema, { maxBytes: 4096 });
  const result = await (await resolveSupplierClaimService()).create(input, agent);
  return okResponse(result, { status: 201, headers: NO_STORE });
}, { ...httpOptions, authenticate: requireAgent });
