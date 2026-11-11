import { describe, expect, it } from "vitest";

import { RETURN_STATUSES, isDamageKind, REQUEST_KINDS, MISSING_RESOLUTIONS, TRANSPORT_RESOLUTIONS } from "./types";
import { complaintStateMachine, damageStateMachine, returnStateMachine, stateMachineFor } from "./transitions";

describe("damage state machine (transport and missing)", () => {
  it("allows exactly submitted to approved or rejected, and approved to resolved", () => {
    expect(damageStateMachine.allowed("submitted")).toEqual(["approved", "rejected"]);
    expect(damageStateMachine.allowed("approved")).toEqual(["resolved"]);
  });

  it("has no return leg", () => {
    expect(damageStateMachine.can("approved", "in_transit")).toBe(false);
    expect(damageStateMachine.can("in_transit", "received")).toBe(false);
    expect(damageStateMachine.can("received", "resolved")).toBe(false);
  });

  it("allows nothing else: every other move is rejected", () => {
    const allowed = new Set(["submitted>approved", "submitted>rejected", "approved>resolved"]);
    for (const from of RETURN_STATUSES) {
      for (const to of RETURN_STATUSES) {
        expect(damageStateMachine.can(from, to), `${from} to ${to}`).toBe(allowed.has(`${from}>${to}`));
      }
    }
  });

  it("treats rejected and resolved as final and refuses an unknown stored status", () => {
    expect(damageStateMachine.allowed("rejected")).toEqual([]);
    expect(damageStateMachine.allowed("resolved")).toEqual([]);
    expect(damageStateMachine.can("unknown", "approved")).toBe(false);
    expect(() => damageStateMachine.assert("submitted", "resolved")).toThrow();
  });

  it("is picked for both kinds, and other kinds keep their machines", () => {
    expect(stateMachineFor("transport")).toBe(damageStateMachine);
    expect(stateMachineFor("missing")).toBe(damageStateMachine);
    expect(stateMachineFor("complaint")).toBe(complaintStateMachine);
    expect(stateMachineFor("return")).toBe(returnStateMachine);
    expect(stateMachineFor("nonsense")).toBe(returnStateMachine);
  });
});

describe("request kinds and remedies of the damage kinds", () => {
  it("lists the two new kinds", () => {
    expect(REQUEST_KINDS).toEqual(["return", "complaint", "transport", "missing"]);
    expect(isDamageKind("transport")).toBe(true);
    expect(isDamageKind("missing")).toBe(true);
    expect(isDamageKind("complaint")).toBe(false);
    expect(isDamageKind(undefined)).toBe(false);
  });

  it("offers resend_part only for a missing item", () => {
    expect(TRANSPORT_RESOLUTIONS).toEqual(["replacement", "refund"]);
    expect(MISSING_RESOLUTIONS).toEqual(["resend_part", "replacement", "refund"]);
  });
});
