import { z } from "zod";

import { checkDecisionNote } from "../../services/returns/decision-note";
import { RETURN_STATUSES, type ReturnStatus } from "../../services/returns/types";

export const returnStatusUpdateSchema: z.ZodType<{ status: ReturnStatus; decisionNote?: string }> = z
  .object({
    status: z.enum(RETURN_STATUSES, "Unknown status"),
    decisionNote: z.string().optional(),
  })
  .superRefine((value, context) => {
    const check = checkDecisionNote(value.status, value.decisionNote);
    if (!check.ok) context.addIssue({ code: "custom", path: ["decisionNote"], message: check.message });
  })
  .transform(({ status, decisionNote }) => {
    const trimmed = decisionNote?.trim();
    return trimmed ? { status, decisionNote: trimmed } : { status };
  });
