import { describe, expect, it } from "vitest";

import { groupBy, median, percentile, share } from "./metrics";

describe("share", () => {
  it("returns null for n = 0", () => {
    expect(share(0, 0)).toBeNull();
  });

  it("computes the Wilson 95% interval for 9 of 12 (hand-computed 0.467–0.911)", () => {
    const result = share(9, 12)!;
    expect(result.value).toBe(0.75);
    expect(result.low).toBeCloseTo(0.47, 2);
    expect(result.high).toBeCloseTo(0.91, 2);
  });

  it("computes 7 of 12 (0.32–0.81)", () => {
    const result = share(7, 12)!;
    expect(result.low).toBeCloseTo(0.32, 2);
    expect(result.high).toBeCloseTo(0.81, 2);
  });

  it("behaves at n = 1 and at the extremes", () => {
    const one = share(1, 1)!;
    expect(one.value).toBe(1);
    expect(one.low).toBeCloseTo(0.2065, 3);
    expect(one.high).toBe(1);
    const none = share(0, 10)!;
    expect(none.low).toBe(0);
    expect(none.high).toBeCloseTo(0.2775, 3);
  });
});

describe("median and percentile", () => {
  it("handles odd, even and empty sets", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(percentile([], 0.75)).toBeNull();
  });

  it("interpolates between closest ranks", () => {
    expect(percentile([5, 2, 4, 8, 7, 3, 10, 4, 6, 2, 1, 3], 0.75)).toBe(6.25);
    expect(percentile([7], 0.9)).toBe(7);
  });
});

describe("groupBy", () => {
  it("groups by key in first-seen order", () => {
    const groups = groupBy([1, 2, 3, 4, 5], (n) => (n % 2 ? "odd" : "even"));
    expect([...groups.keys()]).toEqual(["odd", "even"]);
    expect(groups.get("odd")).toEqual([1, 3, 5]);
  });
});
