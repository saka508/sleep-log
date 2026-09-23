export const MAX_DURATION_HOURS = 24;
export const MAX_DURATION_MINUTES = 59;
export const MAX_DURATION_TOTAL_MINUTES = MAX_DURATION_HOURS * 60;

export type DurationParts = { hours: number; minutes: number };

/** Convert a wheel selection to the minute contract used by analysis. */
export function durationMinutesFromParts(hours: number, minutes: number): number | null {
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > MAX_DURATION_HOURS) return null;
  if (minutes < 0 || minutes > MAX_DURATION_MINUTES) return null;
  const total = hours * 60 + minutes;
  return total <= MAX_DURATION_TOTAL_MINUTES ? total : null;
}

/** Convert stored/engine minutes to the display parts used by the wheel. */
export function durationPartsFromMinutes(total: number): DurationParts | null {
  if (!Number.isInteger(total) || total < 0 || total > MAX_DURATION_TOTAL_MINUTES) return null;
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

export function formatDurationParts(parts: DurationParts): string {
  return `${parts.hours}時間${parts.minutes}分`;
}
