import { defineStateMachine } from "../../state-machine";
import type { ReturnStatus } from "./types";

/** `awaiting_customer`, `in_service` and `cancelled` exist for later specs and have no moves yet. */
export const returnStateMachine = defineStateMachine<ReturnStatus>({
  transitions: {
    submitted: ["approved", "rejected"],
    approved: ["in_transit"],
    in_transit: ["received"],
    received: ["resolved"],
  },
});

/** Statuses whose transition may carry a decision note (the note becomes customer-visible in the customer spec). */
export const DECISION_STATUSES = ["approved", "rejected"] as const satisfies readonly ReturnStatus[];
