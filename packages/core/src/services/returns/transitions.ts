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

/**
 * Transport damage and missing items have no return leg (docs/02 section 2.6: a return is usually unnecessary): an
 * approved request goes straight to `resolved`. When the goods are needed back, the agent asks by mail.
 */
export const damageStateMachine = defineStateMachine<ReturnStatus>({
  transitions: {
    submitted: ["approved", "rejected"],
    approved: ["resolved"],
  },
});

/** The state machine of a request kind; an unknown kind is a return. */
export function stateMachineFor(kind: string | undefined): StateMachine<ReturnStatus> {
  if (kind === "complaint") return complaintStateMachine;
  if (kind === "transport" || kind === "missing") return damageStateMachine;
  return returnStateMachine;
}
