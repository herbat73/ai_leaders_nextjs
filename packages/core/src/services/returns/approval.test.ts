import { describe, expect, it } from "vitest";

import { money } from "../../domain/money";
import { ConfigurationError } from "../../errors";
import { approvalBlockedFor, parseRefundApprovalLimit, requiresManagerApproval } from "./approval";

const LIMIT = money(200000);

describe("parseRefundApprovalLimit", () => {
  it("defaults to 2000 PLN when unset or blank", () => {
    expect(parseRefundApprovalLimit(undefined)).toEqual(money(200000));
    expect(parseRefundApprovalLimit(null)).toEqual(money(200000));
    expect(parseRefundApprovalLimit("  ")).toEqual(money(200000));
  });

  it("reads dot and comma amounts", () => {
    expect(parseRefundApprovalLimit("1500")).toEqual(money(150000));
    expect(parseRefundApprovalLimit("2500,50")).toEqual(money(250050));
    expect(parseRefundApprovalLimit("0")).toEqual(money(0));
  });

  it.each(["abc", "-5", "12,345", "1e3"])("rejects %j as a configuration error", (raw) => {
    expect(() => parseRefundApprovalLimit(raw)).toThrow(ConfigurationError);
  });
});

describe("requiresManagerApproval", () => {
  const refund = (amountMinor: number) => ({ resolution: "refund" as const, resolutionAmount: money(amountMinor) });

  it("does not gate the limit itself, but gates one grosz above", () => {
    expect(requiresManagerApproval(refund(200000), "approved", LIMIT)).toBe(false);
    expect(requiresManagerApproval(refund(200001), "approved", LIMIT)).toBe(true);
  });

  it("never gates store credit, exchange or legacy rows without a resolution", () => {
    expect(requiresManagerApproval({ resolution: "store_credit", resolutionAmount: money(900000) }, "approved", LIMIT)).toBe(false);
    expect(requiresManagerApproval({ resolution: "exchange", resolutionAmount: null }, "approved", LIMIT)).toBe(false);
    expect(requiresManagerApproval({ resolution: null, resolutionAmount: null }, "approved", LIMIT)).toBe(false);
    expect(requiresManagerApproval({}, "approved", LIMIT)).toBe(false);
  });

  it("treats a refund without a stored amount as above the limit (fail closed)", () => {
    expect(requiresManagerApproval({ resolution: "refund", resolutionAmount: null }, "approved", LIMIT)).toBe(true);
    expect(requiresManagerApproval({ resolution: "refund" }, "approved", LIMIT)).toBe(true);
  });

  it("gates only the approval, not any other move", () => {
    for (const target of ["rejected", "awaiting_customer", "in_transit", "received", "resolved", "cancelled"] as const) {
      expect(requiresManagerApproval(refund(900000), target, LIMIT)).toBe(false);
    }
  });
});

describe("approvalBlockedFor", () => {
  it("blocks an agent without MANAGE_RULES above the limit and lets a manager through", () => {
    const large = { resolution: "refund" as const, resolutionAmount: money(250000) };
    expect(approvalBlockedFor({ permissions: [] }, large, LIMIT)).toBe(true);
    expect(approvalBlockedFor({ permissions: ["MANAGE_RULES"] }, large, LIMIT)).toBe(false);
    expect(approvalBlockedFor({ permissions: [] }, { resolution: "refund", resolutionAmount: money(1000) }, LIMIT)).toBe(false);
  });
});
