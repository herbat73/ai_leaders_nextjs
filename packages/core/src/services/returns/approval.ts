import { ConfigurationError } from "../../errors";
import { money, parseMoney, type Money } from "../../domain/money";
import type { AgentContext } from "../agents/types";
import { hasPermission } from "../agents/permissions";
import type { ReturnRequest, ReturnStatus } from "./types";

/** Default refund approval limit in PLN (brief R11). */
export const DEFAULT_REFUND_APPROVAL_LIMIT = money(200000);

export interface ApprovalConfig {
  /** A refund above this amount needs an agent holding `MANAGE_RULES` to approve it; the limit itself does not. */
  refundApprovalLimit: Money;
}

/** Parses `EASYRMS_REFUND_APPROVAL_LIMIT` (core never reads env): unset or blank is 2000 PLN; `2000,50` and `2000.50` work. */
export function parseRefundApprovalLimit(raw: string | null | undefined): Money {
  if (raw === undefined || raw === null || raw.trim() === "") return DEFAULT_REFUND_APPROVAL_LIMIT;
  const limit = parseMoney(raw);
  if (!limit || limit.amountMinor < 0) throw new ConfigurationError("EASYRMS_REFUND_APPROVAL_LIMIT is not a valid amount");
  return limit;
}

/**
 * True when moving `request` to `target` is an approval of a refund above the limit (R11). Only `approved` on a `refund`
 * resolution is gated: store credit and exchange never are, and neither is any other move (a rejection of a large
 * refund is not an approval). The amount is the server-computed one stored at submit, and it is immutable afterwards
 * (the check and the compare-and-set are separate reads, so a future "edit amount" feature must revisit this).
 */
export function requiresManagerApproval(
  request: Pick<ReturnRequest, "resolution" | "resolutionAmount">,
  target: ReturnStatus,
  limit: Money,
): boolean {
  if (target !== "approved" || request.resolution !== "refund") return false;
  // A refund without a stored amount cannot be shown to be within the limit, so a money guard treats it as above it.
  if (!request.resolutionAmount) return true;
  return request.resolutionAmount.amountMinor > limit.amountMinor;
}

/** What the decision card needs to know: would this agent be refused when approving this request? */
export function approvalBlockedFor(
  agent: Pick<AgentContext, "permissions">,
  request: Pick<ReturnRequest, "resolution" | "resolutionAmount">,
  limit: Money,
): boolean {
  return requiresManagerApproval(request, "approved", limit) && !hasPermission(agent, "MANAGE_RULES");
}
