import type { Money } from "../../domain/money";

export interface OrderLine {
  lineRef: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: Money;
  returnable: boolean;
}

export interface ReturnOrder {
  /** The canonical number as the order platform spells it; the only form that is stored, signed or locked on (S8). */
  orderNumber: string;
  /** The customer's e-mail on the order, verified at lookup. Submit stores this value and never one from the request. */
  customerEmail: string;
  /** `null` while the order is not delivered yet. */
  deliveredAt: Date | null;
  trackingUrl?: string;
  lines: OrderLine[];
}

export type OrderLookupResult =
  | { status: "found"; order: ReturnOrder }
  | { status: "not_found" }
  | { status: "unavailable" };

export interface OrderLookup {
  /** Verifies order number and e-mail. A wrong e-mail and an unknown order are indistinguishable (`not_found`). */
  lookup(orderNumber: string, email: string): Promise<OrderLookupResult>;
  /** No e-mail: ownership is already proven by the guest session. */
  getByNumber(orderNumber: string): Promise<OrderLookupResult>;
}

export const DEFAULT_LOOKUP_TIMEOUT_MS = 5000;

const UNAVAILABLE: OrderLookupResult = { status: "unavailable" };

async function settle(call: () => Promise<OrderLookupResult>, timeoutMs: number): Promise<OrderLookupResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<OrderLookupResult>((resolve) => {
    timer = setTimeout(() => resolve(UNAVAILABLE), timeoutMs);
  });
  try {
    // A synchronous throw inside `call` is caught here too.
    return await Promise.race([Promise.resolve().then(call), timeout]);
  } catch {
    return UNAVAILABLE;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Wraps a port so that a slow (> `timeoutMs`, default 5 s) or throwing adapter yields `unavailable`. */
export function withLookupTimeout(port: OrderLookup, options: { timeoutMs?: number } = {}): OrderLookup {
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOOKUP_TIMEOUT_MS;
  return {
    lookup: (orderNumber, email) => settle(() => port.lookup(orderNumber, email), timeoutMs),
    getByNumber: (orderNumber) => settle(() => port.getByNumber(orderNumber), timeoutMs),
  };
}
