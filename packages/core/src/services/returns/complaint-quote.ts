import { addMoney, money, multiplyMoney, type Money } from "../../domain/money";
import type { ReturnOrder } from "../orders/order-lookup.port";
import type { ReturnQuote } from "./quote";
import type { ComplaintResolution } from "./types";

export interface ComplaintQuoteInput {
  lines: { lineRef: string; quantity: number }[];
  resolution: ComplaintResolution;
}

/**
 * A refund is the goods value with no return-shipping deduction (the seller bears the cost of a defective product;
 * R12 speaks of returns); repair and replacement carry no amount. Pure arithmetic: the lines must already be
 * validated (an unknown `lineRef` throws). Recomputed on submit.
 */
export function calculateComplaintQuote(order: ReturnOrder, input: ComplaintQuoteInput, currency: Money["currency"] = "PLN"): ReturnQuote {
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
