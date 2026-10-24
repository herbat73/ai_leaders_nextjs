import { ConfigurationError } from "../../errors";
import { addMoney, applyRate, formatMoney, money, multiplyMoney, parseMoney, type Money } from "../../domain/money";
import type { ReturnOrder } from "../orders/order-lookup.port";
import type { IneligibleReason, OrderEligibility } from "./eligibility";
import type { ReturnMethod, ReturnResolution } from "./types";

export interface ReturnQuoteInput {
  lines: { lineRef: string; quantity: number }[];
  resolution: ReturnResolution;
  returnMethod: ReturnMethod;
}

export interface QuoteConfig {
  shippingFee: Money;
}

/** `amount` and `fee` are `null` for `exchange` (no amount, only a note). */
export interface ReturnQuote {
  amount: Money | null;
  fee: Money | null;
}

export interface ReturnQuoteView {
  amountMinor: number | null;
  feeMinor: number | null;
  currency: Money["currency"];
  amountText: string | null;
  feeText: string | null;
}

/** Store credit is the goods value plus 10 % (R12), in basis points. */
export const STORE_CREDIT_RATE_BASIS_POINTS = 11000;

const FEE_METHODS: readonly ReturnMethod[] = ["parcel_locker", "courier"];

/** Parses `EASYRMS_RETURN_SHIPPING_FEE` (core never reads env): unset or blank is 0 PLN; `12,50` and `12.50` work. */
export function parseShippingFee(raw: string | null | undefined): Money {
  if (raw === undefined || raw === null || raw.trim() === "") return money(0);
  const fee = parseMoney(raw);
  if (!fee) throw new ConfigurationError("EASYRMS_RETURN_SHIPPING_FEE is not a valid amount");
  return fee;
}

/**
 * Per-line problems of a quote request, as `lineRef -> ineligibleReason` for `fieldErrors["items.<lineRef>"]`. An
 * unknown line or any line of an undelivered order is `not_returnable`; a quantity above what remains is
 * `already_claimed`. Empty when every line can be quoted.
 */
export function validateQuoteLines(
  eligibility: OrderEligibility,
  lines: ReturnQuoteInput["lines"],
): Record<string, IneligibleReason> {
  const errors: Record<string, IneligibleReason> = {};
  const byRef = new Map(eligibility.status === "delivered" ? eligibility.lines.map((l) => [l.lineRef, l]) : []);
  for (const { lineRef, quantity } of lines) {
    const line = byRef.get(lineRef);
    if (!line) errors[lineRef] = "not_returnable";
    else if (!line.eligible) errors[lineRef] = line.ineligibleReason ?? "not_returnable";
    else if (quantity > line.remainingQuantity) errors[lineRef] = "already_claimed";
  }
  return errors;
}

/** Pure arithmetic; the lines must already be validated (an unknown `lineRef` throws). Recomputed on submit (R12). */
export function calculateQuote(order: ReturnOrder, input: ReturnQuoteInput, config: QuoteConfig): ReturnQuote {
  if (input.resolution === "exchange") return { amount: null, fee: null };
  const byRef = new Map(order.lines.map((l) => [l.lineRef, l]));
  let goods = money(0, config.shippingFee.currency);
  for (const { lineRef, quantity } of input.lines) {
    const line = byRef.get(lineRef);
    if (!line) throw new RangeError(`Unknown order line ${lineRef}`);
    goods = addMoney(goods, multiplyMoney(line.unitPrice, quantity));
  }
  if (input.resolution === "store_credit") {
    return { amount: applyRate(goods, STORE_CREDIT_RATE_BASIS_POINTS), fee: money(0, goods.currency) };
  }
  const fee = FEE_METHODS.includes(input.returnMethod) ? config.shippingFee : money(0, goods.currency);
  const net = Math.max(0, goods.amountMinor - fee.amountMinor);
  return { amount: money(net, goods.currency), fee };
}

export function toQuoteView(quote: ReturnQuote, currency: Money["currency"] = "PLN"): ReturnQuoteView {
  return {
    amountMinor: quote.amount?.amountMinor ?? null,
    feeMinor: quote.fee?.amountMinor ?? null,
    currency,
    amountText: quote.amount ? formatMoney(quote.amount) : null,
    feeText: quote.fee ? formatMoney(quote.fee) : null,
  };
}
