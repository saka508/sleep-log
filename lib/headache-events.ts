import { HEADACHE_FEATURE_OPTIONS, isDateKey, type HeadacheFeature } from "./sleep-utils";

export const HEADACHE_EVENTS_STORAGE_KEY = "sleep-log.headache-events.v1";
export const HEADACHE_BACKUP_FORMAT = "sleep-log.headache-events";

export type HeadacheEventWeatherSnapshot = {
  pressureHpa: number;
  temperatureC: number;
  condition: string;
  weatherCode: number;
  observedAt: string;
  fetchedAt: string;
  source: "Open-Meteo";
};

export type HeadacheEvent = {
  schemaVersion: 1;
  id: string;
  date: string;
  startedAt: string;
  severity: number | null;
  symptoms: HeadacheFeature[];
  weatherSnapshot?: HeadacheEventWeatherSnapshot;
  source: "manual";
  createdAt: string;
  updatedAt: string;
};

export type HeadacheEventStoreV1 = {
  schemaVersion: 1;
  events: HeadacheEvent[];
};

type HeadacheBackupV1 = {
  format: typeof HEADACHE_BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  events: HeadacheEvent[];
};

const FEATURE_VALUES = new Set<HeadacheFeature>(HEADACHE_FEATURE_OPTIONS.map((option) => option.value));

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function normalizeSeverity(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(10, Math.round(parsed))) : null;
}

function normalizeWeatherSnapshot(value: unknown): HeadacheEventWeatherSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const weather = value as Partial<HeadacheEventWeatherSnapshot>;
  const pressureHpa = Number(weather.pressureHpa);
  const temperatureC = Number(weather.temperatureC);
  const weatherCode = Number(weather.weatherCode);
  if (![pressureHpa, temperatureC, weatherCode].every(Number.isFinite)) return undefined;
  if (typeof weather.condition !== "string" || !weather.condition.trim()) return undefined;
  if (!validTimestamp(weather.observedAt) || !validTimestamp(weather.fetchedAt) || weather.source !== "Open-Meteo") return undefined;
  return {
    pressureHpa: Math.round(pressureHpa * 10) / 10,
    temperatureC: Math.round(temperatureC * 10) / 10,
    condition: weather.condition.trim(),
    weatherCode: Math.round(weatherCode),
    observedAt: weather.observedAt,
    fetchedAt: weather.fetchedAt,
    source: "Open-Meteo",
  };
}

export function normalizeHeadacheEvent(value: unknown): HeadacheEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Partial<HeadacheEvent>;
  if (event.schemaVersion !== 1 || typeof event.id !== "string" || !event.id.trim()) return null;
  if (typeof event.date !== "string" || !isDateKey(event.date) || !validTimestamp(event.startedAt)) return null;
  if (!validTimestamp(event.createdAt) || !validTimestamp(event.updatedAt) || event.source !== "manual") return null;
  const symptoms = Array.isArray(event.symptoms)
    ? [...new Set(event.symptoms.filter((feature): feature is HeadacheFeature => FEATURE_VALUES.has(feature as HeadacheFeature)))]
    : [];
  const weatherSnapshot = normalizeWeatherSnapshot(event.weatherSnapshot);
  return {
    schemaVersion: 1,
    id: event.id.trim(),
    date: event.date,
    startedAt: event.startedAt,
    severity: normalizeSeverity(event.severity),
    symptoms,
    ...(weatherSnapshot ? { weatherSnapshot } : {}),
    source: "manual",
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

export function sortHeadacheEvents(events: HeadacheEvent[]) {
  return [...events].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function normalizeHeadacheEventStore(value: unknown): HeadacheEventStoreV1 {
  if (!value || typeof value !== "object") return { schemaVersion: 1, events: [] };
  const store = value as Partial<HeadacheEventStoreV1>;
  if (store.schemaVersion !== 1 || !Array.isArray(store.events)) return { schemaVersion: 1, events: [] };
  return {
    schemaVersion: 1,
    events: sortHeadacheEvents(store.events.map(normalizeHeadacheEvent).filter((event): event is HeadacheEvent => event !== null)),
  };
}

export function mergeHeadacheEvents(current: HeadacheEvent[], incoming: HeadacheEvent[]) {
  const byId = new Map(current.map((event) => [event.id, event]));
  incoming.forEach((event) => byId.set(event.id, event));
  return sortHeadacheEvents([...byId.values()]);
}

export function createHeadacheEventId(now = Date.now(), random = Math.random()) {
  return `headache-${now.toString(36)}-${random.toString(36).slice(2, 10).padEnd(8, "0")}`;
}

export function localDateTimeToIso(date: string, time: string) {
  if (!isDateKey(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const value = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (!Number.isFinite(value.getTime())) return null;
  if (value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day) return null;
  return value.toISOString();
}

export function headacheEventsToBackupJson(events: HeadacheEvent[], exportedAt = new Date().toISOString()) {
  const backup: HeadacheBackupV1 = {
    format: HEADACHE_BACKUP_FORMAT,
    version: 1,
    exportedAt,
    events: sortHeadacheEvents(events),
  };
  return JSON.stringify(backup, null, 2);
}

export function headacheEventsFromBackupJson(text: string) {
  const parsed = JSON.parse(text) as Partial<HeadacheBackupV1>;
  if (parsed.format !== HEADACHE_BACKUP_FORMAT || parsed.version !== 1 || !Array.isArray(parsed.events)) {
    throw new Error("Invalid headache event backup");
  }
  return sortHeadacheEvents(parsed.events.map(normalizeHeadacheEvent).filter((event): event is HeadacheEvent => event !== null));
}
