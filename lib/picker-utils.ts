import { dateFromKey, dateKey, isDateKey, isTime, timeToMinutes } from "./sleep-utils";

export function localDateForPicker(value: string, fallback = new Date()) {
  return isDateKey(value) ? dateFromKey(value) : dateFromKey(dateKey(fallback));
}

export function dateKeyFromPicker(value: Date) {
  return dateKey(value);
}

export function localTimeForPicker(value: string, fallback = new Date()) {
  const result = new Date(fallback);
  const minutes = timeToMinutes(value);
  if (minutes === null) return result;
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
}

export function timeFromPicker(value: Date, minuteStep = 5) {
  const result = new Date(value);
  const safeStep = Number.isInteger(minuteStep) && minuteStep > 0 ? minuteStep : 1;
  result.setMinutes(Math.round(result.getMinutes() / safeStep) * safeStep, 0, 0);
  return `${String(result.getHours()).padStart(2, "0")}:${String(result.getMinutes()).padStart(2, "0")}`;
}

export function timeParts(value: string) {
  const minutes = timeToMinutes(value);
  return minutes === null ? null : { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

export function timeFromParts(hours: number, minutes: number) {
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return isTime(value) ? value : null;
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function dateFromParts(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
