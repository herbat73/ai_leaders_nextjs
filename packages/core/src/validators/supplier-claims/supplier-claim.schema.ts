import { z } from "zod";

import { parseMoney, type Money } from "../../domain/money";
import { SUPPLIER_CLAIM_STATUSES, type StoredSupplierClaimStatus } from "../../services/supplier-claims/types";

export const CLAIM_NOTE_MAX_LENGTH = 1000;
/** A vendor's rejection must carry a reason that can be shown later (like R15's rule for customers, shorter). */
export const CLAIM_REJECTION_NOTE_MIN_LENGTH = 20;

export interface SupplierClaimCreateInput {
  returnId: number;
  supplierId: number;
  agentNote: string | null;
}

export const supplierClaimCreateSchema: z.ZodType<SupplierClaimCreateInput, unknown> = z.object({
  returnId: z.number().int("Must be a whole number").positive("Must be positive"),
  supplierId: z.number().int("Must be a whole number").positive("Must be positive"),
  agentNote: z
    .string()
    .trim()
    .max(CLAIM_NOTE_MAX_LENGTH, `At most ${CLAIM_NOTE_MAX_LENGTH} characters`)
    .nullish()
    .transform((value) => (value ? value : null)),
});

export interface SupplierClaimAnswerInput {
  status: "accepted" | "rejected" | "credited";
  note: string | null;
  creditAmount?: Money;
}

const amountField = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const parsed = parseMoney(String(value));
    if (!parsed || parsed.amountMinor <= 0) {
      ctx.addIssue({ code: "custom", message: "Enter an amount above zero, e.g. 149,99" });
      return z.NEVER;
    }
    return parsed;
  });

/**
 * Body of `PATCH /api/supplier-claims/[id]`: the move to `accepted` (credit amount required), `rejected` (a reason of at
 * least 20 characters) or `credited`. Whether the amount fits the claim is the service's check.
 */
export const supplierClaimAnswerSchema: z.ZodType<SupplierClaimAnswerInput, unknown> = z
  .object({
    status: z.enum(["accepted", "rejected", "credited"], "Unknown status"),
    note: z
      .string()
      .trim()
      .max(CLAIM_NOTE_MAX_LENGTH, `At most ${CLAIM_NOTE_MAX_LENGTH} characters`)
      .nullish()
      .transform((value) => (value ? value : null)),
    creditAmount: amountField.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "accepted" && !value.creditAmount) {
      ctx.addIssue({ code: "custom", path: ["creditAmount"], message: "Enter the credit note amount" });
    }
    if (value.status !== "accepted" && value.creditAmount) {
      ctx.addIssue({ code: "custom", path: ["creditAmount"], message: "An amount is only recorded when the claim is accepted" });
    }
    if (value.status === "rejected" && (value.note?.length ?? 0) < CLAIM_REJECTION_NOTE_MIN_LENGTH) {
      ctx.addIssue({ code: "custom", path: ["note"], message: `A rejection needs a reason of at least ${CLAIM_REJECTION_NOTE_MIN_LENGTH} characters` });
    }
  })
  .transform(({ status, note, creditAmount }) => ({ status, note, ...(creditAmount ? { creditAmount } : {}) }));

/** `?status=` of the claims list: one of the five statuses, or `unknown` to list corrupt rows. */
export const supplierClaimListQuerySchema: z.ZodType<{ status?: StoredSupplierClaimStatus }> = z.object({
  status: z.enum([...SUPPLIER_CLAIM_STATUSES, "unknown"], "Unknown status").optional(),
});
