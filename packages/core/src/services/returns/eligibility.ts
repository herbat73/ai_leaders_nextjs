import { warsawParts } from "../../calendar/warsaw-time";
import type { ReturnOrder } from "../orders/order-lookup.port";

export const INELIGIBLE_REASONS = ["outside_window", "already_claimed", "not_returnable"] as const;
export type IneligibleReason = (typeof INELIGIBLE_REASONS)[number];

export const DEFAULT_RETURN_WINDOW_DAYS = 30;
export const MIN_RETURN_WINDOW_DAYS = 14;
export const MAX_RETURN_WINDOW_DAYS = 365;

/**
 * Parses `EASYRMS_RETURN_WINDOW_DAYS` (core never reads env): default 30, clamped to 14-365, non-numeric (or empty,
 * or not finite) falls back to 30. A fraction is truncated.
 */
export function clampReturnWindowDays(raw: string | number | null | undefined): number {
  const value = typeof raw === "string" ? (raw.trim() === "" ? Number.NaN : Number(raw.trim())) : raw;
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_RETURN_WINDOW_DAYS;
  return Math.min(MAX_RETURN_WINDOW_DAYS, Math.max(MIN_RETURN_WINDOW_DAYS, Math.trunc(value)));
}

export interface EligibilityConfig {
  windowDays: number;
}

export interface LineEligibility {
  lineRef: string;
  orderedQuantity: number;
  /** Ordered minus claimed, never below 0. */
  remainingQuantity: number;
  eligible: boolean;
  ineligibleReason?: IneligibleReason;
}

export type OrderEligibility =
  /** Nothing is returnable yet; the lookup answers with the tracking link. */
  | { status: "not_delivered"; trackingUrl: string | null }
  | { status: "delivered"; lines: LineEligibility[] };

const DAY_MS = 86_400_000;

/** Days since the epoch of the Warsaw calendar date of `instant`; plain date arithmetic, so a DST change cannot shift it. */
function warsawDayNumber(instant: Date): number {
  const { year, month, day } = warsawParts(instant);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** Whole calendar days in `Europe/Warsaw` from the delivery day (day 0) to `now`. */
export function daysSinceDelivery(deliveredAt: Date, now: Date): number {
  return warsawDayNumber(now) - warsawDayNumber(deliveredAt);
}

/** The window is open through delivery date + `windowDays` (calendar days in `Europe/Warsaw`). */
export function isWithinReturnWindow(deliveredAt: Date, now: Date, windowDays: number): boolean {
  return daysSinceDelivery(deliveredAt, now) <= windowDays;
}

/**
 * Per-line eligibility (R01, R06, S7). `claimed` is `ReturnRepository.claimedQuantities`, which already leaves out
 * cancelled and rejected requests, so those release their quantity. Reason precedence: not returnable, outside the
 * window, already claimed.
 */
export function checkEligibility(
  order: ReturnOrder,
  now: Date,
  config: EligibilityConfig,
  claimed: Record<string, number>,
): OrderEligibility {
  if (order.deliveredAt === null) return { status: "not_delivered", trackingUrl: order.trackingUrl ?? null };
  const inWindow = isWithinReturnWindow(order.deliveredAt, now, config.windowDays);
  const lines = order.lines.map((line): LineEligibility => {
    const remainingQuantity = Math.max(0, line.quantity - (claimed[line.lineRef] ?? 0));
    const base = { lineRef: line.lineRef, orderedQuantity: line.quantity, remainingQuantity };
    if (!line.returnable) return { ...base, eligible: false, ineligibleReason: "not_returnable" };
    if (!inWindow) return { ...base, eligible: false, ineligibleReason: "outside_window" };
    if (remainingQuantity === 0) return { ...base, eligible: false, ineligibleReason: "already_claimed" };
    return { ...base, eligible: true };
  });
  return { status: "delivered", lines };
}
