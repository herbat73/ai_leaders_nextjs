import { addMoney, money, multiplyMoney, type Money } from "../../domain/money";
import type { ReturnOrder } from "../orders/order-lookup.port";
import type { ReturnQuote } from "./quote";
import type { DamageResolution } from "./types";

export interface DamageQuoteInput {
  lines: { lineRef: string; quantity: number }[];
  resolution: DamageResolution;
}

/**
 * Same rule as a complaint: a refund is the goods value with no shipping deduction (the seller bears the cost of
 * goods that arrived broken or incomplete); `resend_part` and `replacement` carry no amount. The lines must already be
 * validated (an unknown `lineRef` throws). Recomputed on submit; the R11 limit is applied when an agent approves.
 */
export function calculateDamageQuote(order: ReturnOrder, input: DamageQuoteInput, currency: Money["currency"] = "PLN"): ReturnQuote {
  if (input.resolution !== "refund") return { amount: null, fee: null };
  const byRef = new Map(order.lines.map((line) => [line.lineRef, line]));
  let goods = money(0, currency);
  for (const { lineRef, quantity } of input.lines) {
    const line = byRef.get(lineRef);
    if (!line) throw new RangeError(`Unknown order line ${lineRef}`);
    goods = addMoney(goods, multiplyMoney(line.unitPrice, quantity));
  }
  return { amount: goods, fee: money(0, currency) };
}
