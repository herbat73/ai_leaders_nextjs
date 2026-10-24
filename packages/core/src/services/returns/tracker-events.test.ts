import { describe, expect, it } from "vitest";

import { trackerEventView } from "./tracker-events";
import type { ReturnEvent } from "./types";

const at = new Date("2026-10-23T10:00:00Z");

function event(over: Partial<ReturnEvent>): ReturnEvent {
  return { id: 1, type: "status_changed", fromStatus: "submitted", toStatus: "approved", note: null, actor: "agent", createdAt: at, ...over };
}

describe("trackerEventView", () => {
  it("maps the submitted event to the customer", () => {
    expect(trackerEventView(event({ type: "submitted", fromStatus: null, toStatus: "submitted", actor: "system" }))).toEqual({
      id: 1,
      key: "event_submitted",
      actor: "customer",
      at,
      note: null,
    });
  });

  it("keeps the decision note on approve and reject, trimmed", () => {
    expect(trackerEventView(event({ note: " Zapraszamy " })).note).toBe("Zapraszamy");
    expect(trackerEventView(event({ toStatus: "rejected", note: "Produkt był używany" })).note).toBe("Produkt był używany");
  });

  it("drops notes on every other status and hides agent identity", () => {
    const view = trackerEventView(event({ toStatus: "in_transit", note: "internal", actor: "agent" }));
    expect(view.note).toBeNull();
    expect(view.actor).toBe("team");
    expect(view.key).toBe("event_in_transit");
    expect(trackerEventView(event({ toStatus: "unknown", note: "x", actor: "system" })).key).toBe("event_unknown");
  });

  it("treats an empty decision note as none", () => {
    expect(trackerEventView(event({ note: "   " })).note).toBeNull();
  });
});
