import { z } from "zod";

import { RETURN_STATUSES, type StoredReturnStatus } from "../../services/returns/types";

/** `?status=` of the list: one of the nine statuses, or `unknown` to list corrupt rows. */
export const returnListQuerySchema: z.ZodType<{ status?: StoredReturnStatus }> = z.object({
  status: z.enum([...RETURN_STATUSES, "unknown"], "Unknown status").optional(),
});
