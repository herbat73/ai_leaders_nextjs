import { ConfigurationError } from "../../errors";
import type { ReturnOrder } from "../orders/order-lookup.port";
import { daysSinceDelivery, safeHttpUrl, type LineEligibility, type OrderEligibility } from "./eligibility";

export const DEFAULT_TRANSPORT_WINDOW_DAYS = 14;
export const MIN_TRANSPORT_WINDOW_DAYS = 1;
export const MAX_TRANSPORT_WINDOW_DAYS = 30;

export interface TransportWindowConfig {
  windowDays: number;
}

/**
 * Parses `EASYRMS_TRANSPORT_WINDOW_DAYS` (core never reads env): unset or blank is 14 (R03); otherwise a whole number
 * from 1 to 30. Anything else is a configuration error, like the other settings that cannot be guessed.
 */
export function parseTransportWindowDays(raw: string | null | undefined): number {
  const value = (raw ?? "").trim();
  if (value === "") return DEFAULT_TRANSPORT_WINDOW_DAYS;
  const days = Number(value);
  if (!/^\d+$/.test(value) || days < MIN_TRANSPORT_WINDOW_DAYS || days > MAX_TRANSPORT_WINDOW_DAYS) {
    throw new ConfigurationError(`EASYRMS_TRANSPORT_WINDOW_DAYS must be a whole number from ${MIN_TRANSPORT_WINDOW_DAYS} to ${MAX_TRANSPORT_WINDOW_DAYS}`);
  }
  return days;
}

/** The window is open through delivery date + `windowDays` (Warsaw calendar days; the delivery day is day 0). */
export function isWithinTransportWindow(deliveredAt: Date, now: Date, windowDays: number): boolean {
  return daysSinceDelivery(deliveredAt, now) <= windowDays;
}

/**
 * Per-line eligibility of a transport-damage or missing-item report. `returnable=false` lines are allowed (the goods
 * arrived broken or incomplete, R06 is about returns). `claimed` is `ReturnRepository.claimedQuantities`, the pool
 * shared with returns and complaints (D14). Reason precedence: outside the window, then already claimed.
 */
export function checkDamageEligibility(
  order: ReturnOrder,
  now: Date,
  config: TransportWindowConfig,
  claimed: Record<string, number>,
): OrderEligibility {
  if (order.deliveredAt === null) return { status: "not_delivered", trackingUrl: safeHttpUrl(order.trackingUrl) };
  const inWindow = isWithinTransportWindow(order.deliveredAt, now, config.windowDays);
  const lines = order.lines.map((line): LineEligibility => {
    const remainingQuantity = Math.max(0, line.quantity - (claimed[line.lineRef] ?? 0));
    const base = { lineRef: line.lineRef, orderedQuantity: line.quantity, remainingQuantity };
    if (!inWindow) return { ...base, eligible: false, ineligibleReason: "outside_window" };
    if (remainingQuantity === 0) return { ...base, eligible: false, ineligibleReason: "already_claimed" };
    return { ...base, eligible: true };
  });
  return { status: "delivered", lines };
}
