import { warsawParts, warsawWallClockToInstant } from "../../calendar/warsaw-time";
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

/** The filter values of `InboxViewOptions` after the same trimming and validation, wherever the filtering runs. */
export interface NormalizedInboxOptions {
  status?: StoredReturnStatus;
  /** Trimmed and lower-cased; absent when empty. */
  search?: string;
  from?: string;
  to?: string;
  /** 1-based and at least 1; the upper bound needs the total, so the caller clamps it. */
  page: number;
}

/**
 * Shared by `viewInbox` (in memory) and `ReturnService.listInbox` (database), so both read the URL values the same way:
 * a blank search and malformed dates are ignored, a non-numeric or non-positive page becomes 1.
 */
export function normalizeInboxOptions(options: InboxViewOptions): NormalizedInboxOptions {
  const search = options.search?.trim().toLowerCase();
  return {
    ...(options.status ? { status: options.status } : {}),
    ...(search ? { search } : {}),
    ...(options.from && DATE_PATTERN.test(options.from) ? { from: options.from } : {}),
    ...(options.to && DATE_PATTERN.test(options.to) ? { to: options.to } : {}),
    page: Math.max(1, Math.trunc(options.page ?? 1) || 1),
  };
}

/**
 * The instants that bound an inclusive Warsaw-day range, for a database that compares timestamps: `start` is 00:00 of
 * `from`, `endExclusive` is 00:00 of the day after `to`. A bound that is absent or not `YYYY-MM-DD` is absent here.
 * Same days as `viewInbox` reads through `warsawDay`, including across a DST change.
 */
export function inboxInstantRange(range: { from?: string; to?: string }): { start?: Date; endExclusive?: Date } {
  const midnight = (day: string, plusDays: number): Date => {
    const [year, month, date] = day.split("-").map(Number) as [number, number, number];
    const shifted = new Date(Date.UTC(year, month - 1, date + plusDays));
    return warsawWallClockToInstant(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), 0, 0, 0, 0);
  };
  return {
    ...(range.from && DATE_PATTERN.test(range.from) ? { start: midnight(range.from, 0) } : {}),
    ...(range.to && DATE_PATTERN.test(range.to) ? { endExclusive: midnight(range.to, 1) } : {}),
  };
}

/** `pageCount` for `total` rows, at least 1. */
export function inboxPageCount(total: number, pageSize: number = INBOX_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Narrows an inbox list by status, RMA fragment and submission-day range, then cuts one page of `INBOX_PAGE_SIZE`. */
export function viewInbox<T extends { rma: string; createdAt: Date; status?: StoredReturnStatus }>(items: T[], options: InboxViewOptions): InboxView<T> {
  const { status, search: needle, from, to, page: requested } = normalizeInboxOptions(options);
  const matching = items.filter((item) => {
    if (status && item.status !== status) return false;
    if (needle && !item.rma.toLowerCase().includes(needle)) return false;
    if (!from && !to) return true;
    const day = warsawDay(item.createdAt);
    return (!from || day >= from) && (!to || day <= to);
  });
  const pageCount = inboxPageCount(matching.length);
  const page = Math.min(requested, pageCount);
  return { rows: matching.slice((page - 1) * INBOX_PAGE_SIZE, page * INBOX_PAGE_SIZE), total: matching.length, page, pageCount };
}
