import { describe, expect, it } from "vitest";

import { trackerView, whatNowKey } from "./tracker-stages";
import type { StoredReturnStatus } from "./types";

function states(status: StoredReturnStatus): string {
  return trackerView(status)
    .stages.map((s) => `${s.id}:${s.state}`)
    .join(",");
}

describe("trackerView", () => {
  it("submitted: first stage current, reply target shown", () => {
    const view = trackerView("submitted");
    expect(states("submitted")).toBe(
      "submitted:current,approved:upcoming,in_transit:upcoming,received:upcoming,resolved:upcoming",
    );
    expect(view.showReplyTarget).toBe(true);
    expect(view.banner).toBeUndefined();
    expect(view.closed).toBeUndefined();
  });

  it("awaiting_customer: banner on the submitted stage", () => {
    const view = trackerView("awaiting_customer");
    expect(view.banner).toBe("awaiting_customer");
    expect(states("awaiting_customer")).toBe(states("submitted"));
    expect(view.showReplyTarget).toBe(false);
  });

  it("approved", () => {
    expect(states("approved")).toBe(
      "submitted:done,approved:current,in_transit:upcoming,received:upcoming,resolved:upcoming",
    );
  });

  it("in_transit", () => {
    expect(states("in_transit")).toBe(
      "submitted:done,approved:done,in_transit:current,received:upcoming,resolved:upcoming",
    );
  });

  it("received", () => {
    expect(states("received")).toBe(
      "submitted:done,approved:done,in_transit:done,received:current,resolved:upcoming",
    );
  });

  it("in_service shows under Received as current", () => {
    expect(states("in_service")).toBe(states("received"));
    expect(trackerView("in_service").whatNow).toBe("what_now_in_service");
  });

  it("resolved: every stage done", () => {
    expect(states("resolved")).toBe(
      "submitted:done,approved:done,in_transit:done,received:done,resolved:done",
    );
  });

  it.each(["rejected", "cancelled", "unknown"] as const)(
    "%s: closed state, no stages",
    (status) => {
      const view = trackerView(status);
      expect(view.closed).toEqual({ kind: status });
      expect(view.stages).toEqual([]);
      expect(view.showReplyTarget).toBe(false);
    },
  );

  it("only submitted shows the reply target", () => {
    const others: StoredReturnStatus[] = [
      "awaiting_customer",
      "approved",
      "in_transit",
      "received",
      "in_service",
      "resolved",
      "rejected",
      "cancelled",
      "unknown",
    ];
    for (const status of others)
      expect(trackerView(status).showReplyTarget).toBe(false);
  });
});

describe("whatNowKey", () => {
  it("is one distinct id per status", () => {
    const all: StoredReturnStatus[] = [
      "submitted",
      "awaiting_customer",
      "approved",
      "in_transit",
      "received",
      "in_service",
      "resolved",
      "rejected",
      "cancelled",
      "unknown",
    ];
    const keys = all.map(whatNowKey);
    expect(new Set(keys).size).toBe(all.length);
    expect(whatNowKey("approved")).toBe("what_now_approved");
  });
});
