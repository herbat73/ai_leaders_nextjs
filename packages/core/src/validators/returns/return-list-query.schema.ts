import { z } from "zod";

import { REQUEST_KINDS, RETURN_STATUSES, type RequestKind, type StoredReturnStatus } from "../../services/returns/types";

/** `?status=` of the list: one of the nine statuses, or `unknown` to list corrupt rows; `?kind=` narrows to returns or complaints. */
export const returnListQuerySchema: z.ZodType<{ status?: StoredReturnStatus; kind?: RequestKind }> = z.object({
  status: z.enum([...RETURN_STATUSES, "unknown"], "Unknown status").optional(),
  kind: z.enum(REQUEST_KINDS, "Unknown kind").optional(),
});
