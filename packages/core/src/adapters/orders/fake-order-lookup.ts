import { money } from "../../domain/money";
import type { OrderLookup, OrderLookupResult, ReturnOrder } from "../../services/orders/order-lookup.port";

const DAY_MS = 24 * 60 * 60 * 1000;

interface SeedOrder {
  email: string;
  /** Days before the injected clock; `null` = not delivered. */
  deliveredDaysAgo: number | null;
  order: Omit<ReturnOrder, "deliveredAt">;
}

/** Seeded Polish-shop orders. Order numbers are canonical (upper case); e-mails are matched case-insensitively. */
const SEEDS: SeedOrder[] = [
  {
    email: "anna.kowalska@example.pl",
    deliveredDaysAgo: 3,
    order: {
      orderNumber: "PL-10001",
      lines: [
        { lineRef: "L1", sku: "BUT-TRK-42", name: "Buty trekkingowe Tatra, rozm. 42", quantity: 1, unitPrice: money(34999), returnable: true },
        { lineRef: "L2", sku: "SKA-WEL-M", name: "Skarpety wełniane, rozm. M", quantity: 1, unitPrice: money(3999), returnable: true },
        { lineRef: "L3", sku: "PLE-30L", name: "Plecak turystyczny 30 l", quantity: 1, unitPrice: money(21900), returnable: true },
      ],
    },
  },
  {
    email: "jan.nowak@example.pl",
    deliveredDaysAgo: 5,
    order: {
      orderNumber: "PL-10002",
      lines: [
        { lineRef: "L1", sku: "KUB-TER-500", name: "Kubek termiczny 500 ml", quantity: 1, unitPrice: money(7900), returnable: true },
        { lineRef: "L2", sku: "BIE-INT-S", name: "Bielizna termoaktywna, rozm. S", quantity: 1, unitPrice: money(8900), returnable: false },
      ],
    },
  },
  {
    email: "ewa.wisniewska@example.pl",
    deliveredDaysAgo: 120,
    order: {
      orderNumber: "PL-10003",
      lines: [{ lineRef: "L1", sku: "KUR-ZIM-L", name: "Kurtka zimowa, rozm. L", quantity: 1, unitPrice: money(54900), returnable: true }],
    },
  },
  {
    email: "piotr.zielinski@example.pl",
    deliveredDaysAgo: null,
    order: {
      orderNumber: "PL-10004",
      trackingUrl: "https://tracking.example.pl/przesylka/PL10004",
      lines: [{ lineRef: "L1", sku: "NAMIOT-2", name: "Namiot dwuosobowy", quantity: 1, unitPrice: money(45900), returnable: true }],
    },
  },
  {
    email: "maria.lewandowska@example.pl",
    deliveredDaysAgo: 2,
    order: {
      orderNumber: "PL-10005",
      lines: [
        { lineRef: "L1", sku: "RKW-SKR-L", name: "Rękawiczki skórzane, rozm. L", quantity: 3, unitPrice: money(6900), returnable: true },
        { lineRef: "L2", sku: "CZA-POL", name: "Czapka polarowa", quantity: 2, unitPrice: money(4900), returnable: true },
      ],
    },
  },
];

/** Pure constant-time string comparison (length is compared without early exit over the longer input). */
function constantTimeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

const normalizeNumber = (value: string): string => value.trim().toUpperCase();
const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const NO_EMAIL = "\u0000no-such-order";

function snapshot(seed: SeedOrder, now: Date): ReturnOrder {
  return {
    ...seed.order,
    deliveredAt: seed.deliveredDaysAgo === null ? null : new Date(now.getTime() - seed.deliveredDaysAgo * DAY_MS),
    lines: seed.order.lines.map((line) => ({ ...line, unitPrice: { ...line.unitPrice } })),
  };
}

/** In-memory `OrderLookup` over the seeds above; `deliveredAt` is computed from `clock` so seeds stay fresh. */
export function createFakeOrderLookup(options: { clock?: () => Date } = {}): OrderLookup {
  const clock = options.clock ?? ((): Date => new Date());
  const find = (orderNumber: string): SeedOrder | undefined => {
    const wanted = normalizeNumber(orderNumber);
    return SEEDS.find((seed) => seed.order.orderNumber === wanted);
  };
  return {
    async lookup(orderNumber, email): Promise<OrderLookupResult> {
      const seed = find(orderNumber);
      // One code path for an unknown order and a wrong e-mail: always compare, then decide.
      const emailMatches = constantTimeEqual(normalizeEmail(email), seed?.email ?? NO_EMAIL);
      if (!seed || !emailMatches) return { status: "not_found" };
      return { status: "found", order: snapshot(seed, clock()) };
    },
    async getByNumber(orderNumber): Promise<OrderLookupResult> {
      const seed = find(orderNumber);
      return seed ? { status: "found", order: snapshot(seed, clock()) } : { status: "not_found" };
    },
  };
}
