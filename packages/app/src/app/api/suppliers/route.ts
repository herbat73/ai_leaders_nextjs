import { apiHandler, okResponse, parseJsonBody, requirePermission, supplierCreateSchema } from "@easyrms/core";

import { requireAgent } from "@/server/agent-auth";
import { resolveSupplierService } from "@/server/container";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/** Every signed-in agent: the list feeds the vendor choice on a claim. Active suppliers first. */
export const GET = apiHandler(async () => okResponse({ suppliers: await (await resolveSupplierService()).list() }, { headers: NO_STORE }), {
  ...httpOptions,
  authenticate: requireAgent,
});

/** `MANAGE_RULES` only. A duplicate name (any case) is a 409 `conflict` with `fieldErrors.name`. */
export const POST = apiHandler(async (request, _context, agent) => {
  requirePermission(agent, "MANAGE_RULES");
  const input = await parseJsonBody(request, supplierCreateSchema, { maxBytes: 8192 });
  return okResponse({ supplier: await (await resolveSupplierService()).create(input) }, { status: 201, headers: NO_STORE });
}, { ...httpOptions, authenticate: requireAgent });
