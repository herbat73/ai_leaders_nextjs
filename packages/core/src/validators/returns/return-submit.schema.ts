import { z } from "zod";

import {
  RETURN_METHODS,
  RETURN_REASON_CODES,
  RETURN_RESOLUTIONS,
  type ReturnMethod,
  type ReturnReasonCode,
  type ReturnResolution,
} from "../../services/returns/types";
import { MAX_RETURN_ITEMS } from "./return-quote.schema";

export const MAX_ITEM_COMMENT_LENGTH = 500;
export const MAX_EXCHANGE_NOTE_LENGTH = 200;

export interface ReturnSubmitBody {
  items: { lineRef: string; quantity: number; reasonCode: ReturnReasonCode; comment?: string }[];
  resolution: ReturnResolution;
  exchangeNote?: string;
  returnMethod: ReturnMethod;
  acknowledged: true;
  idempotencyKey: string;
}

/**
 * Body of `POST /api/returns`. Unknown keys are stripped, so a client-supplied amount
 * or e-mail never reaches the service. `exchangeNote` is required only for `exchange`.
 */
export const returnSubmitSchema: z.ZodType<ReturnSubmitBody> = z
  .object({
    items: z
      .array(
        z.object({
          lineRef: z.string().trim().min(1, "Line reference is required").max(64, "Line reference is too long"),
          quantity: z.number().int("Quantity must be a whole number").positive("Quantity must be positive"),
          reasonCode: z.enum(RETURN_REASON_CODES),
          comment: z.string().trim().max(MAX_ITEM_COMMENT_LENGTH, `At most ${MAX_ITEM_COMMENT_LENGTH} characters`).optional(),
        }),
      )
      .min(1, "Select at least one item")
      .max(MAX_RETURN_ITEMS, `At most ${MAX_RETURN_ITEMS} items`),
    resolution: z.enum(RETURN_RESOLUTIONS),
    exchangeNote: z.string().trim().max(MAX_EXCHANGE_NOTE_LENGTH, `At most ${MAX_EXCHANGE_NOTE_LENGTH} characters`).optional(),
    returnMethod: z.enum(RETURN_METHODS),
    acknowledged: z.literal(true, { error: "You must accept the return terms" }),
    idempotencyKey: z.uuid("Idempotency key must be a UUID"),
  })
  .superRefine((body, ctx) => {
    const seen = new Set<string>();
    body.items.forEach((item, index) => {
      if (seen.has(item.lineRef)) {
        ctx.addIssue({ code: "custom", path: ["items", index, "lineRef"], message: "Duplicate line" });
      }
      seen.add(item.lineRef);
    });
    if (body.resolution === "exchange" && !body.exchangeNote) {
      ctx.addIssue({ code: "custom", path: ["exchangeNote"], message: "Describe the exchange you want" });
    }
  });
