export const BUSINESS_TIME_ZONE = "Europe/Warsaw";

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  weekday: "short",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The wall-clock reading of an instant in `Europe/Warsaw`. */
export function warsawParts(instant: Date): ZonedParts {
  const read: Record<string, string> = {};
  for (const part of partsFormat.formatToParts(instant)) read[part.type] = part.value;
  return {
    year: Number(read.year),
    month: Number(read.month),
    day: Number(read.day),
    hour: Number(read.hour),
    minute: Number(read.minute),
    second: Number(read.second),
    weekday: WEEKDAYS.indexOf(read.weekday),
  };
}

function offsetMs(instant: number): number {
  const parts = warsawParts(new Date(instant));
  const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wallAsUtc - Math.floor(instant / 1000) * 1000;
}

/** The instant whose Warsaw wall-clock reading is the given one (the later instant when a reading occurs twice). */
export function warsawWallClockToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
): Date {
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const first = wallAsUtc - offsetMs(wallAsUtc);
  return new Date(wallAsUtc - offsetMs(first));
}
