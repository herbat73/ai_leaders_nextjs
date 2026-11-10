import { INBOX_PAGE_SIZE, inboxPageCount } from "../returns/inbox-view";
import type { Supplier } from "./types";

/** Longest filter text read from a URL; anything beyond it cannot match a stored name (120) or e-mail (254). */
export const SUPPLIER_FILTER_MAX_LENGTH = 254;

export type SupplierStatusFilter = "active" | "inactive";

export interface SupplierViewOptions {
  /** Keeps only active or only inactive suppliers; absent keeps both. */
  status?: SupplierStatusFilter;
  /** Part of the supplier name, case-insensitive. */
  name?: string;
  /** Part of the supplier e-mail, case-insensitive. */
  email?: string;
  /** 1-based; clamped into range. */
  page?: number;
}

export interface SupplierView {
  rows: Supplier[];
  total: number;
  page: number;
  pageCount: number;
}

function needle(value: string | undefined): string | undefined {
  const text = value?.trim().toLowerCase().slice(0, SUPPLIER_FILTER_MAX_LENGTH);
  return text || undefined;
}

/**
 * Narrows the supplier list by status, name fragment and e-mail fragment (all must match), then cuts one page.
 * The input order is kept. The page size is the inbox's, so both admin lists page alike.
 */
export function viewSuppliers(items: Supplier[], options: SupplierViewOptions): SupplierView {
  const name = needle(options.name);
  const email = needle(options.email);
  const matching = items.filter((item) => {
    if (options.status && item.active !== (options.status === "active")) return false;
    if (name && !item.name.toLowerCase().includes(name)) return false;
    if (email && !item.email.toLowerCase().includes(email)) return false;
    return true;
  });
  const pageCount = inboxPageCount(matching.length);
  const page = Math.min(Math.max(1, Math.trunc(options.page ?? 1) || 1), pageCount);
  return { rows: matching.slice((page - 1) * INBOX_PAGE_SIZE, page * INBOX_PAGE_SIZE), total: matching.length, page, pageCount };
}
