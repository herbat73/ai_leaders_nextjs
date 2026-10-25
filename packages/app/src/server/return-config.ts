import {
  clampReturnWindowDays,
  parseRefundApprovalLimit,
  parseShippingFee,
  type ApprovalConfig,
  type EligibilityConfig,
  type QuoteConfig,
} from "@easyrms/core";

let eligibility: EligibilityConfig | undefined;
let quote: QuoteConfig | undefined;
let approval: ApprovalConfig | undefined;

/** `EASYRMS_RETURN_WINDOW_DAYS`, clamped; memoized, read on first use and never at import. */
export function getEligibilityConfig(): EligibilityConfig {
  eligibility ??= { windowDays: clampReturnWindowDays(process.env.EASYRMS_RETURN_WINDOW_DAYS) };
  return eligibility;
}

/** `EASYRMS_RETURN_SHIPPING_FEE`; memoized, an invalid value is a configuration error on first use. */
export function getQuoteConfig(): QuoteConfig {
  quote ??= { shippingFee: parseShippingFee(process.env.EASYRMS_RETURN_SHIPPING_FEE) };
  return quote;
}

/** `EASYRMS_REFUND_APPROVAL_LIMIT` (PLN, default 2000); memoized, an invalid value is a configuration error on first use. */
export function getApprovalConfig(): ApprovalConfig {
  approval ??= { refundApprovalLimit: parseRefundApprovalLimit(process.env.EASYRMS_REFUND_APPROVAL_LIMIT) };
  return approval;
}
