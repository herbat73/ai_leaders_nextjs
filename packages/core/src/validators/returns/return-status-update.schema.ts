import { z } from "zod";

import { checkDecisionNote } from "../../services/returns/decision-note";
import { RETURN_STATUSES, type ReturnStatus } from "../../services/returns/types";

export const returnStatusUpdateSchema: z.ZodType<{ status: ReturnStatus; decisionNote?: string; defectConfirmed?: boolean }> = z
  .object({
    status: z.enum(RETURN_STATUSES, "Unknown status"),
    decisionNote: z.string().optional(),
    /** Complaints only: the agent's finding, required with the move to `received` (checked by the service). */
    defectConfirmed: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    const check = checkDecisionNote(value.status, value.decisionNote);
    if (!check.ok) context.addIssue({ code: "custom", path: ["decisionNote"], message: check.message });
  })
  .transform(({ status, decisionNote, defectConfirmed }) => {
    const trimmed = decisionNote?.trim();
    return {
      status,
      ...(trimmed ? { decisionNote: trimmed } : {}),
      ...(defectConfirmed === undefined ? {} : { defectConfirmed }),
    };
  });
