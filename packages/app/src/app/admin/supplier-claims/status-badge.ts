import type { StoredSupplierClaimStatus } from "@easyrms/core";

import type { StatusBadgeVariant } from "../returns/status-badge";

/** Tone = who has to move next: warning = the claim has not left yet, info = waiting for the vendor, success = money is coming or booked, destructive = rejected. */
export const claimBadgeVariant: Record<StoredSupplierClaimStatus, StatusBadgeVariant> = {
  draft: "warning",
  sent: "info",
  accepted: "success",
  rejected: "destructive",
  credited: "success",
  unknown: "outline",
};
