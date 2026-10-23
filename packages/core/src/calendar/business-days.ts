import { warsawParts, warsawWallClockToInstant } from "./warsaw-time";

const SATURDAY = 6;
const SUNDAY = 0;
const REPLY_TARGET_BUSINESS_DAYS = 2;
const SUBMITTED = "submitted";

/**
 * Moves `from` forward by `days` business days (Mon–Fri in `Europe/Warsaw`, no holiday calendar), keeping the
 * Warsaw time of day. Starting on a weekend, the first business day is the following Monday.
 */
export function addBusinessDays(from: Date, days: number): Date {
  const start = warsawParts(from);
  const cursor = new Date(Date.UTC(start.year, start.month - 1, start.day));
  let remaining = days;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== SATURDAY && weekday !== SUNDAY) remaining -= 1;
  }
  return warsawWallClockToInstant(
    cursor.getUTCFullYear(),
    cursor.getUTCMonth() + 1,
    cursor.getUTCDate(),
    start.hour,
    start.minute,
    start.second,
    from.getUTCMilliseconds(),
  );
}

/** The internal "we reply within 2 business days" target for a request created at `createdAt`. */
export function dueAt(createdAt: Date): Date {
  return addBusinessDays(createdAt, REPLY_TARGET_BUSINESS_DAYS);
}

/** True when the request is still `submitted` and `now` is strictly past `due`. A display aid only. */
export function overdue(status: string, due: Date, now: Date): boolean {
  return status === SUBMITTED && now.getTime() > due.getTime();
}
