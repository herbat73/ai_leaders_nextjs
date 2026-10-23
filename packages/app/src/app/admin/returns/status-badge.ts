import type { StoredReturnStatus } from "@easyrms/core";

export const statusBadgeVariant: Record<StoredReturnStatus, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "outline",
  awaiting_customer: "outline",
  approved: "default",
  in_transit: "default",
  received: "secondary",
  in_service: "secondary",
  resolved: "secondary",
  rejected: "destructive",
  cancelled: "destructive",
  unknown: "destructive",
};
