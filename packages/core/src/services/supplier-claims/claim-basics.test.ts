import { describe, expect, it } from "vitest";

import { formatClaimRef } from "./reference";
import { supplierClaimStateMachine } from "./transitions";

describe("formatClaimRef", () => {
  it("pads to five digits with the Warsaw year", () => {
    expect(formatClaimRef(7, new Date("2026-06-01T10:00:00Z"))).toBe("SC-2026-00007");
    expect(formatClaimRef(123456, new Date("2026-06-01T10:00:00Z"))).toBe("SC-2026-123456");
  });

  it("uses the Warsaw calendar year at the turn of the year", () => {
    expect(formatClaimRef(1, new Date("2026-12-31T23:30:00Z"))).toBe("SC-2027-00001");
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects the sequence %s", (sequence) => {
    expect(() => formatClaimRef(sequence, new Date())).toThrow(RangeError);
  });
});

describe("supplierClaimStateMachine", () => {
  it("allows only the documented path", () => {
    expect(supplierClaimStateMachine.allowed("draft")).toEqual(["sent"]);
    expect(supplierClaimStateMachine.allowed("sent")).toEqual(["accepted", "rejected"]);
    expect(supplierClaimStateMachine.allowed("accepted")).toEqual(["credited"]);
    expect(supplierClaimStateMachine.allowed("rejected")).toEqual([]);
    expect(supplierClaimStateMachine.allowed("credited")).toEqual([]);
  });

  it("refuses skipping the e-mail or reopening an answer", () => {
    expect(supplierClaimStateMachine.can("draft", "accepted")).toBe(false);
    expect(supplierClaimStateMachine.can("rejected", "accepted")).toBe(false);
    expect(supplierClaimStateMachine.can("sent", "credited")).toBe(false);
    expect(supplierClaimStateMachine.can("unknown", "sent")).toBe(false);
  });
});
