// The page size, page count and day rules are the inbox's, so every admin list pages and reads dates alike.
import { INBOX_PAGE_SIZE, inboxPageCount, normalizeInboxOptions, warsawDay } from "../returns/inbox-view";
import type { SupplierClaimView } from "./types";

/** Longest filter text read from a URL; anything beyond it cannot match a stored reference, RMA or supplier name. */
export const SUPPLIER_CLAIM_FILTER_MAX_LENGTH = 254;

export interface SupplierClaimViewOptions {
  /** Part of the claim number (`SC-…`) or of the complaint's RMA, case-insensitive. */
  q?: string;
  /** Part of the supplier name, case-insensitive. */
  supplier?: string;
  /** Inclusive `YYYY-MM-DD` bounds on the creation day, read in Europe/Warsaw. Malformed values are ignored. */
  from?: string;
  to?: string;
  /** 1-based; clamped into range. */
  page?: number;
}

export interface SupplierClaimListView<T> {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
}

function needle(value: string | undefined): string | undefined {
  const text = value?.trim().toLowerCase().slice(0, SUPPLIER_CLAIM_FILTER_MAX_LENGTH);
  return text || undefined;
}

/**
 * Narrows supplier claims by number fragment, supplier fragment and creation-day range (all must match), then cuts one
 * page. The input order is kept. Status is not handled here: the repository already filters it.
 */
export function viewSupplierClaims<T extends Pick<SupplierClaimView, "ref" | "rma" | "supplierName" | "createdAt">>(
  items: T[],
  options: SupplierClaimViewOptions,
): SupplierClaimListView<T> {
  const { from, to, page: requested } = normalizeInboxOptions({ from: options.from, to: options.to, page: options.page });
  const q = needle(options.q);
  const supplier = needle(options.supplier);
  const matching = items.filter((item) => {
    if (q && !item.ref.toLowerCase().includes(q) && !item.rma.toLowerCase().includes(q)) return false;
    if (supplier && !item.supplierName.toLowerCase().includes(supplier)) return false;
    if (!from && !to) return true;
    const day = warsawDay(item.createdAt);
    return (!from || day >= from) && (!to || day <= to);
  });
  const pageCount = inboxPageCount(matching.length);
  const page = Math.min(requested, pageCount);
  return { rows: matching.slice((page - 1) * INBOX_PAGE_SIZE, page * INBOX_PAGE_SIZE), total: matching.length, page, pageCount };
}
