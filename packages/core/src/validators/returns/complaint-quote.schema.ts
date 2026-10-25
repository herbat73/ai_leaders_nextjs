import { z } from "zod";

import { COMPLAINT_RESOLUTIONS, RETURN_METHODS, type ComplaintResolution, type ReturnMethod } from "../../services/returns/types";
import { MAX_RETURN_ITEMS } from "./return-quote.schema";

export interface ComplaintQuoteBody {
  kind: "complaint";
  items: { lineRef: string; quantity: number }[];
  returnMethod: ReturnMethod;
  resolution: ComplaintResolution;
}

/** Quote body for a complaint: like a return quote, with the complaint remedies. */
export const complaintQuoteSchema: z.ZodType<ComplaintQuoteBody> = z
  .object({
    kind: z.literal("complaint"),
    items: z
      .array(
        z.object({
          lineRef: z.string().trim().min(1, "Line reference is required").max(64, "Line reference is too long"),
          quantity: z.number().int("Quantity must be a whole number").positive("Quantity must be positive"),
        }),
      )
      .min(1, "Select at least one item")
      .max(MAX_RETURN_ITEMS, `At most ${MAX_RETURN_ITEMS} items`),
    returnMethod: z.enum(RETURN_METHODS),
    resolution: z.enum(COMPLAINT_RESOLUTIONS),
  })
  .superRefine((body, ctx) => {
    const seen = new Set<string>();
    body.items.forEach((item, index) => {
      if (seen.has(item.lineRef)) ctx.addIssue({ code: "custom", path: ["items", index, "lineRef"], message: "Duplicate line" });
      seen.add(item.lineRef);
    });
  });
