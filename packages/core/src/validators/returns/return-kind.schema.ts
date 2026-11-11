import { z } from "zod";

import { complaintQuoteSchema, type ComplaintQuoteBody } from "./complaint-quote.schema";
import { complaintSubmitSchema, type ComplaintSubmitBody } from "./complaint-submit.schema";
import { damageQuoteSchema, type DamageQuoteBody } from "./damage-quote.schema";
import { damageSubmitSchema, type DamageSubmitBody } from "./damage-submit.schema";
import { returnQuoteSchema, type ReturnQuoteBody } from "./return-quote.schema";
import { returnSubmitSchema, type ReturnSubmitBody } from "./return-submit.schema";

function kindOf(raw: unknown): unknown {
  return typeof raw === "object" && raw !== null ? (raw as { kind?: unknown }).kind : undefined;
}

/** Dispatches on `kind`: `complaint`, `transport` and `missing` select their schemas, anything else (including no `kind`) is a return. */
function byKind<T>(schemas: { complaint: z.ZodType<unknown>; damage: z.ZodType<unknown>; ret: z.ZodType<unknown> }): z.ZodType<T> {
  return z.unknown().transform((raw, ctx) => {
    const kind = kindOf(raw);
    const schema = kind === "complaint" ? schemas.complaint : kind === "transport" || kind === "missing" ? schemas.damage : schemas.ret;
    const result = schema.safeParse(raw);
    if (result.success) return result.data as T;
    for (const issue of result.error.issues) ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
    return z.NEVER;
  }) as unknown as z.ZodType<T>;
}

/** Body of `POST /api/returns`: a return (no `kind`, unchanged), a complaint, or transport damage / a missing item. `now` is the clock. */
export function submitRequestSchema(now: Date): z.ZodType<ReturnSubmitBody | ComplaintSubmitBody | DamageSubmitBody> {
  return byKind({ complaint: complaintSubmitSchema(now), damage: damageSubmitSchema(now), ret: returnSubmitSchema });
}

/** Body of `POST /api/returns/quote`: a return quote (no `kind`), a complaint quote, or a damage quote. */
export const quoteRequestSchema: z.ZodType<ReturnQuoteBody | ComplaintQuoteBody | DamageQuoteBody> = byKind({
  complaint: complaintQuoteSchema,
  damage: damageQuoteSchema,
  ret: returnQuoteSchema,
});
