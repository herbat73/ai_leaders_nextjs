import { defineStateMachine, type StateMachine } from "../../state-machine";
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

/**
 * Complaints (kind `complaint`) add the repair path: `received` goes to `in_service` (at a service or the vendor) or
 * straight to `resolved`. `awaiting_customer` and `cancelled` still have no moves.
 */
export const complaintStateMachine = defineStateMachine<ReturnStatus>({
  transitions: {
    submitted: ["approved", "rejected"],
    approved: ["in_transit"],
    in_transit: ["received"],
    received: ["in_service", "resolved"],
    in_service: ["resolved"],
  },
});

/** The state machine of a request kind; anything but `complaint` is a return. */
export function stateMachineFor(kind: string | undefined): StateMachine<ReturnStatus> {
  return kind === "complaint" ? complaintStateMachine : returnStateMachine;
}
