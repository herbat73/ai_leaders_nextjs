import { z } from "zod";

import type { LegacyNewReturnRequest } from "../../services/returns/types";

export const returnRequestCreateSchema: z.ZodType<LegacyNewReturnRequest> = z.object({
  orderNumber: z.string().trim().min(1, "Order number is required"),
  customerEmail: z.string().trim().pipe(z.email("A valid email is required")),
  reason: z.string().trim().min(1, "Please tell us why you are returning the item"),
});
