import { z } from "zod";

import { warsawDateString } from "../../services/returns/complaint-eligibility";
import { MAX_EVIDENCE_FILES } from "../../services/evidence/types";
import { MISSING_REASON_CODES, MISSING_RESOLUTIONS, type DamageResolution, type MissingReasonCode } from "../../services/returns/types";
import { COMPLAINT_DESCRIPTION_MAX_LENGTH, COMPLAINT_DESCRIPTION_MIN_LENGTH } from "./complaint-submit.schema";
import { damageItemSchema, isDamageResolutionOf } from "./damage-quote.schema";
import { MAX_RETURN_ITEMS } from "./return-quote.schema";

export interface DamageSubmitBody {
  kind: "transport" | "missing";
  /** `reasonCode` is read for `missing` only (default `missing_element`); transport always uses `damaged_in_transit`. */
  items: { lineRef: string; quantity: number; reasonCode?: MissingReasonCode }[];
  defectDescription: string;
  defectDiscoveredOn: string;
  /** Transport only, optional (Q11): was the parcel accepted with a courier note. */
  courierNote?: boolean;
  /** One to six staged files of this session's order, uploaded through `POST /api/evidence` (Q2, Q14). */
  evidenceFileIds: string[];
  resolution: DamageResolution;
  acknowledged: true;
  idempotencyKey: string;
}

/**
 * Body of `POST /api/returns` with `kind: "transport"` or `"missing"`. No return method; at least one photo is required
 * (Q2, Q14). `now` is injected as for complaints: the noticed-on date may not lie in
 * the future; that it is not before delivery is checked by the service, which knows the order.
 */
export function damageSubmitSchema(now: Date): z.ZodType<DamageSubmitBody> {
  const today = warsawDateString(now);
  return z
    .object({
      kind: z.enum(["transport", "missing"]),
      items: z
        .array(damageItemSchema.extend({ reasonCode: z.enum(MISSING_REASON_CODES).optional() }))
        .min(1, "Select at least one item")
        .max(MAX_RETURN_ITEMS, `At most ${MAX_RETURN_ITEMS} items`),
      defectDescription: z
        .string()
        .trim()
        .min(COMPLAINT_DESCRIPTION_MIN_LENGTH, `Describe the problem in at least ${COMPLAINT_DESCRIPTION_MIN_LENGTH} characters`)
        .max(COMPLAINT_DESCRIPTION_MAX_LENGTH, `At most ${COMPLAINT_DESCRIPTION_MAX_LENGTH} characters`),
      defectDiscoveredOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
        .refine((value) => new Date(`${value}T00:00:00Z`).toISOString().startsWith(value), "Not a valid date")
        .refine((value) => value <= today, "The date cannot be in the future"),
      courierNote: z.boolean().optional(),
      evidenceFileIds: z
        .array(z.uuid("Not a valid file id"))
        .min(1, "Add at least one photo")
        .max(MAX_EVIDENCE_FILES, `At most ${MAX_EVIDENCE_FILES} photos`),
      resolution: z.enum(MISSING_RESOLUTIONS),
      acknowledged: z.literal(true, { error: "You must accept the terms" }),
      idempotencyKey: z.uuid("Idempotency key must be a UUID"),
    })
    .superRefine((body, ctx) => {
      if (!isDamageResolutionOf(body.kind, body.resolution)) {
        ctx.addIssue({ code: "custom", path: ["resolution"], message: "This remedy is not available for this kind of report" });
      }
      if (body.kind === "missing" && body.courierNote !== undefined) {
        ctx.addIssue({ code: "custom", path: ["courierNote"], message: "The courier note applies to transport damage only" });
      }
      if (new Set(body.evidenceFileIds).size !== body.evidenceFileIds.length) {
        ctx.addIssue({ code: "custom", path: ["evidenceFileIds"], message: "The same photo is listed twice" });
      }
      const seen = new Set<string>();
      body.items.forEach((item, index) => {
        if (seen.has(item.lineRef)) ctx.addIssue({ code: "custom", path: ["items", index, "lineRef"], message: "Duplicate line" });
        seen.add(item.lineRef);
        if (body.kind === "transport" && item.reasonCode !== undefined) {
          ctx.addIssue({ code: "custom", path: ["items", index, "reasonCode"], message: "Not used for transport damage" });
        }
      });
    });
}
