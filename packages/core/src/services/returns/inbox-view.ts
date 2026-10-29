import { warsawParts } from "../../calendar/warsaw-time";
import type { StoredReturnStatus } from "./types";

export const INBOX_PAGE_SIZE = 10;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface InboxViewOptions {
  /** Keeps only rows in this status; absent keeps every status. */
  status?: StoredReturnStatus;
  /** Part of the RMA number, case-insensitive. */
  search?: string;
  /** Inclusive `YYYY-MM-DD` bounds on the submission day, read in Europe/Warsaw. Malformed values are ignored. */
  from?: string;
  to?: string;
  /** 1-based; clamped into range. */
  page?: number;
}

export interface InboxView<T> {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
}

function warsawDay(date: Date): string {
  const { year, month, day } = warsawParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Narrows an inbox list by status, RMA fragment and submission-day range, then cuts one page of `INBOX_PAGE_SIZE`. */
export function viewInbox<T extends { rma: string; createdAt: Date; status?: StoredReturnStatus }>(items: T[], options: InboxViewOptions): InboxView<T> {
  const needle = options.search?.trim().toLowerCase();
  const from = options.from && DATE_PATTERN.test(options.from) ? options.from : undefined;
  const to = options.to && DATE_PATTERN.test(options.to) ? options.to : undefined;
  const matching = items.filter((item) => {
    if (options.status && item.status !== options.status) return false;
    if (needle && !item.rma.toLowerCase().includes(needle)) return false;
    if (!from && !to) return true;
    const day = warsawDay(item.createdAt);
    return (!from || day >= from) && (!to || day <= to);
  });
  const pageCount = Math.max(1, Math.ceil(matching.length / INBOX_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(options.page ?? 1) || 1), pageCount);
  return { rows: matching.slice((page - 1) * INBOX_PAGE_SIZE, page * INBOX_PAGE_SIZE), total: matching.length, page, pageCount };
}
