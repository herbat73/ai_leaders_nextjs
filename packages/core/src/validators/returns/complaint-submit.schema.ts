import { z } from "zod";

import { warsawDateString } from "../../services/returns/complaint-eligibility";
import { COMPLAINT_RESOLUTIONS, RETURN_METHODS, type ComplaintResolution, type ReturnMethod } from "../../services/returns/types";
import { MAX_RETURN_ITEMS } from "./return-quote.schema";

export const COMPLAINT_DESCRIPTION_MIN_LENGTH = 20;
export const COMPLAINT_DESCRIPTION_MAX_LENGTH = 2000;
export const MAX_SERIAL_NUMBER_LENGTH = 100;

export interface ComplaintSubmitBody {
  kind: "complaint";
  items: { lineRef: string; quantity: number; serialNumber?: string }[];
  defectDescription: string;
  defectDiscoveredOn: string;
  resolution: ComplaintResolution;
  returnMethod: ReturnMethod;
  acknowledged: true;
  idempotencyKey: string;
}

/**
 * Body of `POST /api/returns` with `kind: "complaint"`. `now` is injected so tests (and the route) decide what "today"
 * is: the discovery date may not lie in the future (Warsaw calendar day). That it is not before delivery is checked by
 * the service, which knows the order.
 */
export function complaintSubmitSchema(now: Date): z.ZodType<ComplaintSubmitBody> {
  const today = warsawDateString(now);
  return z
    .object({
      kind: z.literal("complaint"),
      items: z
        .array(
          z.object({
            lineRef: z.string().trim().min(1, "Line reference is required").max(64, "Line reference is too long"),
            quantity: z.number().int("Quantity must be a whole number").positive("Quantity must be positive"),
            serialNumber: z.string().trim().max(MAX_SERIAL_NUMBER_LENGTH, `At most ${MAX_SERIAL_NUMBER_LENGTH} characters`).optional(),
          }),
        )
        .min(1, "Select at least one item")
        .max(MAX_RETURN_ITEMS, `At most ${MAX_RETURN_ITEMS} items`),
      defectDescription: z
        .string()
        .trim()
        .min(COMPLAINT_DESCRIPTION_MIN_LENGTH, `Describe the defect in at least ${COMPLAINT_DESCRIPTION_MIN_LENGTH} characters`)
        .max(COMPLAINT_DESCRIPTION_MAX_LENGTH, `At most ${COMPLAINT_DESCRIPTION_MAX_LENGTH} characters`),
      defectDiscoveredOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
        .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value), "Not a valid date")
        .refine((value) => value <= today, "The date cannot be in the future"),
      resolution: z.enum(COMPLAINT_RESOLUTIONS),
      returnMethod: z.enum(RETURN_METHODS),
      acknowledged: z.literal(true, { error: "You must accept the complaint terms" }),
      idempotencyKey: z.uuid("Idempotency key must be a UUID"),
    })
    .superRefine((body, ctx) => {
      const seen = new Set<string>();
      body.items.forEach((item, index) => {
        if (seen.has(item.lineRef)) ctx.addIssue({ code: "custom", path: ["items", index, "lineRef"], message: "Duplicate line" });
        seen.add(item.lineRef);
      });
    });
}
