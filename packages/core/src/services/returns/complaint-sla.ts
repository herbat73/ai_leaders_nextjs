import { warsawParts, warsawWallClockToInstant } from "../../calendar/warsaw-time";
import type { StoredReturnStatus } from "./types";

/** R04: the statutory answer period for a complaint, in calendar days. Tracked for agents, never promised to customers (Q10). */
export const COMPLAINT_RESPONSE_DAYS = 14;
/** Q07: from this day on, an unanswered complaint is escalated in the inbox. */
export const COMPLAINT_ESCALATION_DAY = 10;

const DAY_MS = 86_400_000;

/** `createdAt` moved forward by `days` calendar days, keeping the Warsaw time of day (a DST change cannot shift it). */
function addCalendarDays(from: Date, days: number): Date {
  const start = warsawParts(from);
  const cursor = new Date(Date.UTC(start.year, start.month - 1, start.day + days));
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

export function complaintDueAt(createdAt: Date): Date {
  return addCalendarDays(createdAt, COMPLAINT_RESPONSE_DAYS);
}

export function complaintEscalatesAt(createdAt: Date): Date {
  return addCalendarDays(createdAt, COMPLAINT_ESCALATION_DAY);
}

/** Only a complaint still `submitted` has an open answer deadline (an approval or rejection is the answer). */
export function complaintAwaitsAnswer(status: StoredReturnStatus): boolean {
  return status === "submitted";
}

/** Calendar days (Warsaw) from today to the due day; negative once the deadline has passed. */
export function complaintDaysLeft(createdAt: Date, now: Date): number {
  const due = warsawParts(complaintDueAt(createdAt));
  const today = warsawParts(now);
  return Math.round((Date.UTC(due.year, due.month - 1, due.day) - Date.UTC(today.year, today.month - 1, today.day)) / DAY_MS);
}

export function complaintEscalated(status: StoredReturnStatus, createdAt: Date, now: Date): boolean {
  return complaintAwaitsAnswer(status) && now.getTime() >= complaintEscalatesAt(createdAt).getTime();
}
