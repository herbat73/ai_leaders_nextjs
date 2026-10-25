import { defineStateMachine } from "../../state-machine";
import type { SupplierClaimStatus } from "./types";

/** `draft → sent` (a delivered e-mail), the vendor's answer, then the booking of the credit note. */
export const supplierClaimStateMachine = defineStateMachine<SupplierClaimStatus>({
  transitions: {
    draft: ["sent"],
    sent: ["accepted", "rejected"],
    accepted: ["credited"],
  },
});
