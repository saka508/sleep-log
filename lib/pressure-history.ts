export const PRESSURE_HISTORY_SOURCE = "Open-Meteo" as const;
export const PRESSURE_REFERENCE_TOLERANCE_MS = 30 * 60 * 1000;
export const PRESSURE_HISTORY_STORAGE_KEY = "sleep-log.pressure-history.v1";
export const PRESSURE_HISTORY_BACKUP_FORMAT = "sleep-log.pressure-history";
export const PRESSURE_HISTORY_RETENTION_DAYS = 30;
export const MAX_PRESSURE_HISTORY_BATCHES = 100;

export type PressureHistoryPeriod = "day" | "week" | "month";

export const PRESSURE_HISTORY_PERIOD_DAYS: Record<PressureHistoryPeriod, number> = {
  day: 1,
  week: 7,
  // This is the persisted-history retention boundary, not a newly invented
  // analytics window.
  month: PRESSURE_HISTORY_RETENTION_DAYS,
};

export type PressureKind = "surface_pressure" | "pressure_msl";

/**
 * This scope is deliberately opaque. It must identify one fetched location
 * without containing latitude, longitude, or an address in persisted data.
 */
export type PressureLocationScope = string;

export type PressureHistoryPoint = {
  observedAt: string;
  pressureHpa: number;
  pressureKind: PressureKind;
  locationScope: PressureLocationScope;
  source: typeof PRESSURE_HISTORY_SOURCE;
};

export type PressureChange = {
  changeHpa: number;
  targetObservedAt: string;
  referenceObservedAt: string;
  referenceOffsetMs: number;
};

export type PressureChangeSummary = {
  latest?: PressureHistoryPoint;
  change3Hours?: PressureChange;
  change24Hours?: PressureChange;
};

type TimedPressurePoint = PressureHistoryPoint & { timestampMs: number };

function toTimedPoint(point: PressureHistoryPoint): TimedPressurePoint | undefined {
  const timestampMs = Date.parse(point.observedAt);
  if (!Number.isFinite(timestampMs) || !Number.isFinite(point.pressureHpa) || !point.locationScope.trim()) return undefined;
  return { ...point, timestampMs };
}

function roundHpa(value: number) {
  return Math.round(value * 10) / 10;
}

function referenceFor(
  latest: TimedPressurePoint,
  points: TimedPressurePoint[],
  hoursBefore: number,
  toleranceMs: number,
): PressureChange | undefined {
  const targetTimestampMs = latest.timestampMs - hoursBefore * 60 * 60 * 1000;
  const reference = points
    .filter((point) => (
      point.locationScope === latest.locationScope
      && point.pressureKind === latest.pressureKind
      && point.source === latest.source
    ))
    .map((point) => ({ point, offsetMs: Math.abs(point.timestampMs - targetTimestampMs) }))
    .filter(({ offsetMs }) => offsetMs <= toleranceMs)
    .sort((a, b) => a.offsetMs - b.offsetMs || a.point.timestampMs - b.point.timestampMs)[0];

  if (!reference) return undefined;
  return {
    changeHpa: roundHpa(latest.pressureHpa - reference.point.pressureHpa),
    targetObservedAt: latest.observedAt,
    referenceObservedAt: reference.point.observedAt,
    referenceOffsetMs: reference.offsetMs,
  };
}

/**
 * Calculates pressure changes from timestamped points, never from array order.
 * Points from another pressure kind, source, or location scope are excluded.
 */
export function calculatePressureChanges(
  input: PressureHistoryPoint[],
  options: { referenceToleranceMs?: number } = {},
): PressureChangeSummary {
  const toleranceMs = options.referenceToleranceMs ?? PRESSURE_REFERENCE_TOLERANCE_MS;
  if (!Number.isFinite(toleranceMs) || toleranceMs < 0) return {};

  const points = input
    .map(toTimedPoint)
    .filter((point): point is TimedPressurePoint => point !== undefined)
    .sort((a, b) => a.timestampMs - b.timestampMs);
  const latest = points.at(-1);
  if (!latest) return {};

  return {
    latest: {
      observedAt: latest.observedAt,
      pressureHpa: latest.pressureHpa,
      pressureKind: latest.pressureKind,
      locationScope: latest.locationScope,
      source: latest.source,
    },
    change3Hours: referenceFor(latest, points, 3, toleranceMs),
    change24Hours: referenceFor(latest, points, 24, toleranceMs),
  };
}

export function pressureHistoryAgeMs(fetchedAt: string, now = Date.now()) {
  const fetchedAtMs = Date.parse(fetchedAt);
  if (!Number.isFinite(fetchedAtMs) || !Number.isFinite(now)) return undefined;
  return Math.max(0, now - fetchedAtMs);
}

export function isPressureHistoryStale(fetchedAt: string, maximumAgeMs: number, now = Date.now()) {
  const ageMs = pressureHistoryAgeMs(fetchedAt, now);
  return ageMs === undefined || !Number.isFinite(maximumAgeMs) || maximumAgeMs < 0 || ageMs > maximumAgeMs;
}

export type StoredPressureHistoryPoint = {
  observedAt: string;
  pressureHpa: number;
};

/**
 * A batch is an opaque location boundary. It intentionally contains no
 * coordinates, address, or reversible location identifier.
 */
export type PressureHistoryBatch = {
  schemaVersion: 1;
  id: string;
  pressureKind: "surface_pressure";
  source: typeof PRESSURE_HISTORY_SOURCE;
  fetchedAt: string;
  latestAvailableAt: string;
  points: StoredPressureHistoryPoint[];
};

export type PressureHistoryStoreV1 = {
  schemaVersion: 1;
  batches: PressureHistoryBatch[];
};

export type PressureHistoryPeriodSelection = {
  period: PressureHistoryPeriod;
  days: number;
  startAt: string | null;
  endAt: string | null;
  batches: PressureHistoryBatch[];
  pointCount: number;
  latestBatch: PressureHistoryBatch | null;
};

type PressureHistoryBackupV1 = {
  format: typeof PRESSURE_HISTORY_BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  store: PressureHistoryStoreV1;
};

export type PressureHistoryBatchInput = {
  fetchedAt: string;
  latestAvailableAt: string;
  points: PressureHistoryPoint[];
};

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function normalizeStoredPoint(value: unknown): StoredPressureHistoryPoint | undefined {
  if (!value || typeof value !== "object") return undefined;
  const point = value as Partial<StoredPressureHistoryPoint>;
  const pressureHpa = Number(point.pressureHpa);
  if (!validTimestamp(point.observedAt) || !Number.isFinite(pressureHpa) || pressureHpa < 300 || pressureHpa > 1200) return undefined;
  return { observedAt: point.observedAt, pressureHpa: roundHpa(pressureHpa) };
}

export function normalizePressureHistoryBatch(value: unknown): PressureHistoryBatch | null {
  if (!value || typeof value !== "object") return null;
  const batch = value as Partial<PressureHistoryBatch>;
  if (batch.schemaVersion !== 1 || typeof batch.id !== "string" || !batch.id.trim()) return null;
  if (batch.pressureKind !== "surface_pressure" || batch.source !== PRESSURE_HISTORY_SOURCE) return null;
  if (!validTimestamp(batch.fetchedAt) || !validTimestamp(batch.latestAvailableAt) || !Array.isArray(batch.points)) return null;
  const latestAvailableMs = Date.parse(batch.latestAvailableAt);
  const points = batch.points
    .map(normalizeStoredPoint)
    .filter((point): point is StoredPressureHistoryPoint => point !== undefined)
    .filter((point) => Date.parse(point.observedAt) <= latestAvailableMs)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  if (!points.length) return null;
  return {
    schemaVersion: 1,
    id: batch.id.trim(),
    pressureKind: "surface_pressure",
    source: PRESSURE_HISTORY_SOURCE,
    fetchedAt: batch.fetchedAt,
    latestAvailableAt: batch.latestAvailableAt,
    points,
  };
}

function cutoffTimestamp(now: Date) {
  return now.getTime() - PRESSURE_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

export function normalizePressureHistoryStore(value: unknown, now = new Date()): PressureHistoryStoreV1 {
  if (!value || typeof value !== "object") return { schemaVersion: 1, batches: [] };
  const store = value as Partial<PressureHistoryStoreV1>;
  if (store.schemaVersion !== 1 || !Array.isArray(store.batches)) return { schemaVersion: 1, batches: [] };
  const byId = new Map<string, PressureHistoryBatch>();
  const cutoff = cutoffTimestamp(now);
  store.batches
    .map(normalizePressureHistoryBatch)
    .filter((batch): batch is PressureHistoryBatch => batch !== null)
    .filter((batch) => Date.parse(batch.fetchedAt) >= cutoff)
    .forEach((batch) => byId.set(batch.id, batch));
  return {
    schemaVersion: 1,
    batches: [...byId.values()]
      .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))
      .slice(0, MAX_PRESSURE_HISTORY_BATCHES),
  };
}

export function createPressureHistoryBatchId(now = Date.now(), random = Math.random()) {
  return `pressure-${now.toString(36)}-${random.toString(36).slice(2, 10).padEnd(8, "0")}`;
}

export function createPressureHistoryBatch(input: PressureHistoryBatchInput, id = createPressureHistoryBatchId()): PressureHistoryBatch | null {
  const candidate: PressureHistoryBatch = {
    schemaVersion: 1,
    id,
    pressureKind: "surface_pressure",
    source: PRESSURE_HISTORY_SOURCE,
    fetchedAt: input.fetchedAt,
    latestAvailableAt: input.latestAvailableAt,
    points: input.points
      .filter((point) => point.pressureKind === "surface_pressure" && point.source === PRESSURE_HISTORY_SOURCE)
      .map((point) => ({ observedAt: point.observedAt, pressureHpa: point.pressureHpa })),
  };
  return normalizePressureHistoryBatch(candidate);
}

export function mergePressureHistoryBatches(current: PressureHistoryBatch[], incoming: PressureHistoryBatch[], now = new Date()) {
  const byId = new Map(current.map((batch) => [batch.id, batch]));
  incoming.forEach((batch) => byId.set(batch.id, batch));
  return normalizePressureHistoryStore({ schemaVersion: 1, batches: [...byId.values()] }, now).batches;
}

export function calculatePressureChangesForBatch(batch: PressureHistoryBatch) {
  return calculatePressureChanges(batch.points.map((point) => ({
    ...point,
    pressureKind: batch.pressureKind,
    locationScope: batch.id,
    source: batch.source,
  })));
}

/**
 * Selects only stored points in a local-independent timestamp window. Batches
 * stay separate because their opaque IDs are location boundaries; callers
 * must not draw a continuous line across them.
 */
export function selectPressureHistoryPeriod(
  input: PressureHistoryBatch[],
  period: PressureHistoryPeriod,
): PressureHistoryPeriodSelection {
  const days = PRESSURE_HISTORY_PERIOD_DAYS[period];
  const allPoints = input.flatMap((batch) => batch.points.map((point) => ({ batch, point, timestamp: Date.parse(point.observedAt) })))
    .filter(({ timestamp }) => Number.isFinite(timestamp));
  const endTimestamp = allPoints.reduce((latest, entry) => Math.max(latest, entry.timestamp), Number.NEGATIVE_INFINITY);
  if (!Number.isFinite(endTimestamp)) return { period, days, startAt: null, endAt: null, batches: [], pointCount: 0, latestBatch: null };

  const startTimestamp = endTimestamp - days * 24 * 60 * 60 * 1000;
  const batches = input.map((batch) => ({
    ...batch,
    points: batch.points.filter((point) => {
      const timestamp = Date.parse(point.observedAt);
      return Number.isFinite(timestamp) && timestamp >= startTimestamp && timestamp <= endTimestamp;
    }),
  })).filter((batch) => batch.points.length > 0)
    .sort((a, b) => a.points[0].observedAt.localeCompare(b.points[0].observedAt));
  const latestBatch = batches.reduce<PressureHistoryBatch | null>((latest, batch) => {
    if (!latest) return batch;
    const latestPoint = latest.points.at(-1)?.observedAt ?? "";
    const batchPoint = batch.points.at(-1)?.observedAt ?? "";
    return batchPoint > latestPoint ? batch : latest;
  }, null);

  return {
    period,
    days,
    startAt: new Date(startTimestamp).toISOString(),
    endAt: new Date(endTimestamp).toISOString(),
    batches,
    pointCount: batches.reduce((count, batch) => count + batch.points.length, 0),
    latestBatch,
  };
}

export function pressureHistoryToBackupJson(store: PressureHistoryStoreV1, exportedAt = new Date().toISOString()) {
  const backup: PressureHistoryBackupV1 = {
    format: PRESSURE_HISTORY_BACKUP_FORMAT,
    version: 1,
    exportedAt,
    store: normalizePressureHistoryStore(store),
  };
  return JSON.stringify(backup, null, 2);
}

export function pressureHistoryFromBackupJson(text: string, now = new Date()) {
  const parsed = JSON.parse(text) as Partial<PressureHistoryBackupV1>;
  if (parsed.format !== PRESSURE_HISTORY_BACKUP_FORMAT || parsed.version !== 1 || !parsed.store) {
    throw new Error("Invalid pressure history backup");
  }
  return normalizePressureHistoryStore(parsed.store, now);
}
