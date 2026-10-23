import { BUSINESS_TIME_ZONE } from "./warsaw-time";

const eventTimeFormat = new Intl.DateTimeFormat("pl-PL", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Timeline timestamp for display, e.g. `23.10.2026, 12:05` (pl-PL, `Europe/Warsaw`). */
export function formatEventTime(at: Date): string {
  return eventTimeFormat.format(at);
}
