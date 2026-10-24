import type { StoredReturnStatus } from "@easyrms/core";

export type StatusBadgeVariant = "info" | "success" | "warning" | "destructive" | "secondary" | "outline";

/** Tone = who has to move next: warning = someone is waiting to act (agent on submitted, customer on awaiting_customer), info = in motion, success = resolved, destructive = closed without a refund. */
export const statusBadgeVariant: Record<StoredReturnStatus, StatusBadgeVariant> = {
  submitted: "warning",
  awaiting_customer: "warning",
  approved: "info",
  in_transit: "info",
  received: "info",
  in_service: "info",
  resolved: "success",
  rejected: "destructive",
  cancelled: "secondary",
  unknown: "outline",
};
