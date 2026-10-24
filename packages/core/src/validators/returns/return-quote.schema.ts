import { z } from "zod";

import { RETURN_METHODS, RETURN_RESOLUTIONS, type ReturnMethod, type ReturnResolution } from "../../services/returns/types";

export const MAX_RETURN_ITEMS = 20;

export interface ReturnQuoteBody {
  items: { lineRef: string; quantity: number }[];
  returnMethod: ReturnMethod;
  resolution: ReturnResolution;
}

/** Quote body: 1-20 items, no duplicate `lineRef`, positive integer quantities. */
export const returnQuoteSchema: z.ZodType<ReturnQuoteBody> = z
  .object({
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
    resolution: z.enum(RETURN_RESOLUTIONS),
  })
  .superRefine((body, ctx) => {
    const seen = new Set<string>();
    body.items.forEach((item, index) => {
      if (seen.has(item.lineRef)) {
        ctx.addIssue({ code: "custom", path: ["items", index, "lineRef"], message: "Duplicate line" });
      }
      seen.add(item.lineRef);
    });
  });
