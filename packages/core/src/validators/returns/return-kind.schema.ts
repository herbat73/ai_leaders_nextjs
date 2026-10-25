import { z } from "zod";

import { complaintQuoteSchema, type ComplaintQuoteBody } from "./complaint-quote.schema";
import { complaintSubmitSchema, type ComplaintSubmitBody } from "./complaint-submit.schema";
import { returnQuoteSchema, type ReturnQuoteBody } from "./return-quote.schema";
import { returnSubmitSchema, type ReturnSubmitBody } from "./return-submit.schema";

function isComplaint(raw: unknown): boolean {
  return typeof raw === "object" && raw !== null && (raw as { kind?: unknown }).kind === "complaint";
}

/** Dispatches on `kind`: `"complaint"` selects the complaint schema, anything else (including no `kind`) is a return. */
function byKind<T>(complaint: z.ZodType<unknown>, ret: z.ZodType<unknown>): z.ZodType<T> {
  return z.unknown().transform((raw, ctx) => {
    const result = (isComplaint(raw) ? complaint : ret).safeParse(raw);
    if (result.success) return result.data as T;
    for (const issue of result.error.issues) ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
    return z.NEVER;
  }) as unknown as z.ZodType<T>;
}

/** Body of `POST /api/returns`: a return (no `kind`, unchanged) or a complaint (`kind: "complaint"`). `now` is the clock. */
export function submitRequestSchema(now: Date): z.ZodType<ReturnSubmitBody | ComplaintSubmitBody> {
  return byKind(complaintSubmitSchema(now), returnSubmitSchema);
}

/** Body of `POST /api/returns/quote`: a return quote (no `kind`) or a complaint quote. */
export const quoteRequestSchema: z.ZodType<ReturnQuoteBody | ComplaintQuoteBody> = byKind(complaintQuoteSchema, returnQuoteSchema);
