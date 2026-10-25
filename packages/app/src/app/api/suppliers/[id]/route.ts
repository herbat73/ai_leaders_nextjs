import { makeCrudRoute, requirePermission, supplierUpdateSchema } from "@easyrms/core";

import { requireAgent } from "@/server/agent-auth";
import { resolveSupplierService } from "@/server/container";
import { httpOptions } from "@/server/http-options";

// `MANAGE_RULES` only: rename, change the address or guidelines, deactivate or reactivate. Suppliers are never deleted.
export const { PATCH } = makeCrudRoute({
  ...httpOptions,
  authenticate: requireAgent,
  resolve: resolveSupplierService,
  patch: {
    schema: supplierUpdateSchema,
    handler: (service, id, input, agent) => {
      requirePermission(agent, "MANAGE_RULES");
      return service.update(id, input);
    },
  },
});
