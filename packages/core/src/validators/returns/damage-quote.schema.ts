import { z } from "zod";

import { MISSING_RESOLUTIONS, TRANSPORT_RESOLUTIONS, type DamageResolution } from "../../services/returns/types";
import { MAX_RETURN_ITEMS } from "./return-quote.schema";

export interface DamageQuoteBody {
  kind: "transport" | "missing";
  items: { lineRef: string; quantity: number }[];
  resolution: DamageResolution;
}

/** Whether `resolution` is one of the remedies of `kind` (transport: replacement or refund; missing adds resend_part). */
export function isDamageResolutionOf(kind: "transport" | "missing", resolution: string): boolean {
  return (kind === "transport" ? (TRANSPORT_RESOLUTIONS as readonly string[]) : (MISSING_RESOLUTIONS as readonly string[])).includes(resolution);
}

export const damageItemSchema = z.object({
  lineRef: z.string().trim().min(1, "Line reference is required").max(64, "Line reference is too long"),
  quantity: z.number().int("Quantity must be a whole number").positive("Quantity must be positive"),
});

/** Quote body for transport damage or a missing item: no return method; the remedy depends on the kind. */
export const damageQuoteSchema: z.ZodType<DamageQuoteBody> = z
  .object({
    kind: z.enum(["transport", "missing"]),
    items: z.array(damageItemSchema).min(1, "Select at least one item").max(MAX_RETURN_ITEMS, `At most ${MAX_RETURN_ITEMS} items`),
    resolution: z.enum(MISSING_RESOLUTIONS),
  })
  .superRefine((body, ctx) => {
    if (!isDamageResolutionOf(body.kind, body.resolution)) {
      ctx.addIssue({ code: "custom", path: ["resolution"], message: "This remedy is not available for this kind of report" });
    }
    const seen = new Set<string>();
    body.items.forEach((item, index) => {
      if (seen.has(item.lineRef)) ctx.addIssue({ code: "custom", path: ["items", index, "lineRef"], message: "Duplicate line" });
      seen.add(item.lineRef);
    });
  });
