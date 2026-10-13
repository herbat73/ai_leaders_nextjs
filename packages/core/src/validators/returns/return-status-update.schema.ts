import { z } from "zod";

import { RETURN_STATUSES, type ReturnStatus } from "../../services/returns/types";

export const returnStatusUpdateSchema: z.ZodType<{ status: ReturnStatus }> = z.object({
  status: z.enum(RETURN_STATUSES, "Unknown status"),
});
