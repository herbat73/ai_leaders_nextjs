import { warsawParts } from "../../calendar/warsaw-time";
import type { ReturnOrder } from "../orders/order-lookup.port";
import { safeHttpUrl, type LineEligibility, type OrderEligibility } from "./eligibility";

/** R02: a complaint may be filed up to 24 months after delivery. A statutory period, so not configurable. */
export const COMPLAINT_WINDOW_MONTHS = 24;

const DAY_MS = 86_400_000;

function dayNumber(year: number, month: number, day: number): number {
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

/**
 * The last day (Warsaw calendar) on which a complaint is accepted for a product delivered at `deliveredAt`: the same
 * date `COMPLAINT_WINDOW_MONTHS` later, or that month's last day when it has no such date (29 February).
 */
export function complaintWindowEnd(deliveredAt: Date): { year: number; month: number; day: number } {
  const { year, month, day } = warsawParts(deliveredAt);
  const targetYear = year + COMPLAINT_WINDOW_MONTHS / 12;
  const daysInMonth = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return { year: targetYear, month, day: Math.min(day, daysInMonth) };
}

/** True through the last day of the window (calendar days in `Europe/Warsaw`). */
export function isWithinComplaintWindow(deliveredAt: Date, now: Date): boolean {
  const end = complaintWindowEnd(deliveredAt);
  const today = warsawParts(now);
  return dayNumber(today.year, today.month, today.day) <= dayNumber(end.year, end.month, end.day);
}

/**
 * Per-line eligibility of a complaint. `returnable=false` lines may be complained about (R06). `claimed` is
 * `ReturnRepository.claimedQuantities`, shared with returns, so a unit held by an open return or complaint cannot be
 * claimed again. Reason precedence: outside the window, then already claimed.
 */
export function checkComplaintEligibility(order: ReturnOrder, now: Date, claimed: Record<string, number>): OrderEligibility {
  if (order.deliveredAt === null) return { status: "not_delivered", trackingUrl: safeHttpUrl(order.trackingUrl) };
  const inWindow = isWithinComplaintWindow(order.deliveredAt, now);
  const lines = order.lines.map((line): LineEligibility => {
    const remainingQuantity = Math.max(0, line.quantity - (claimed[line.lineRef] ?? 0));
    const base = { lineRef: line.lineRef, orderedQuantity: line.quantity, remainingQuantity };
    if (!inWindow) return { ...base, eligible: false, ineligibleReason: "outside_window" };
    if (remainingQuantity === 0) return { ...base, eligible: false, ineligibleReason: "already_claimed" };
    return { ...base, eligible: true };
  });
  return { status: "delivered", lines };
}

/** `YYYY-MM-DD` of the Warsaw calendar day of `instant`. */
export function warsawDateString(instant: Date): string {
  const { year, month, day } = warsawParts(instant);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
