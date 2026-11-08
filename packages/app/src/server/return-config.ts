import {
  clampReturnWindowDays,
  parseManagerInviteTtl,
  parseRefundApprovalLimit,
  BRIEF_RULES,
  parseRulesRecommendationsFlag,
  parseShippingFee,
  type RecommendationConfig,
  type AgentInviteConfig,
  type ApprovalConfig,
  type EligibilityConfig,
  type QuoteConfig,
} from "@easyrms/core";

let eligibility: EligibilityConfig | undefined;
let quote: QuoteConfig | undefined;
let approval: ApprovalConfig | undefined;
let invite: AgentInviteConfig | undefined;
let recommendation: RecommendationConfig | undefined;

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

/** `EASYRMS_MANAGER_INVITE_TTL_HOURS` (default 8); memoized, an invalid value is a configuration error on first use. */
export function getInviteConfig(): AgentInviteConfig {
  invite ??= parseManagerInviteTtl(process.env.EASYRMS_MANAGER_INVITE_TTL_HOURS);
  return invite;
}

/** `EASYRMS_RULES_RECOMMENDATIONS` (`on` / `off`, default off); memoized, an invalid value is a configuration error on first use. */
export function getRecommendationConfig(): RecommendationConfig {
  recommendation ??= { enabled: parseRulesRecommendationsFlag(process.env.EASYRMS_RULES_RECOMMENDATIONS), rules: BRIEF_RULES };
  return recommendation;
}
