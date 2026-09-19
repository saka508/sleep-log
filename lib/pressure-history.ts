export const PRESSURE_HISTORY_SOURCE = "Open-Meteo" as const;
export const PRESSURE_REFERENCE_TOLERANCE_MS = 30 * 60 * 1000;

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
