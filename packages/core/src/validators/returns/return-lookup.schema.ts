import { z } from "zod";

export interface ReturnLookupInput {
  orderNumber: string;
  email: string;
}

/** Customer lookup body. Format only: whether the order exists is never revealed by validation. */
export const returnLookupSchema: z.ZodType<ReturnLookupInput> = z.object({
  orderNumber: z.string().trim().min(1, "Order number is required").max(64, "Order number is too long"),
  email: z.string().trim().max(254, "Email is too long").pipe(z.email("A valid email is required")),
});
