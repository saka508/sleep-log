import { describe, expect, it } from "vitest";

import {
  calculatePressureChanges,
  calculatePressureChangesForBatch,
  buildPressureHistoryDays,
  createPressureHistoryBatch,
  createPressureHistoryBatchId,
  isPressureHistoryStale,
  normalizePressureHistoryStore,
  pressureHistoryFromBackupJson,
  pressureHistoryToBackupJson,
  PRESSURE_HISTORY_SOURCE,
  PRESSURE_REFERENCE_TOLERANCE_MS,
  selectPressureHistoryPeriod,
  type PressureHistoryPoint,
} from "../lib/pressure-history";

const point = (
  observedAt: string,
  pressureHpa: number,
  overrides: Partial<PressureHistoryPoint> = {},
): PressureHistoryPoint => ({
  observedAt,
  pressureHpa,
  pressureKind: "surface_pressure",
  locationScope: "location-a",
  source: PRESSURE_HISTORY_SOURCE,
  ...overrides,
});

describe("pressure history calculations", () => {
  it("calculates rising, falling, and unchanged pressure from matching timestamps", () => {
    const rising = calculatePressureChanges([
      point("2026-09-15T00:00:00.000Z", 1000),
      point("2026-09-15T03:00:00.000Z", 1002.1),
      point("2026-09-14T03:00:00.000Z", 996),
    ]);
    expect(rising.change3Hours?.changeHpa).toBe(2.1);
    expect(rising.change24Hours?.changeHpa).toBe(6.1);

    const falling = calculatePressureChanges([
      point("2026-09-15T00:00:00.000Z", 1005),
      point("2026-09-15T03:00:00.000Z", 1002.8),
    ]);
    expect(falling.change3Hours?.changeHpa).toBe(-2.2);

    const unchanged = calculatePressureChanges([
      point("2026-09-15T00:00:00.000Z", 1002.8),
      point("2026-09-15T03:00:00.000Z", 1002.8),
    ]);
    expect(unchanged.change3Hours?.changeHpa).toBe(0);
  });

  it("keeps unavailable references as data insufficient instead of substituting zero", () => {
    const summary = calculatePressureChanges([point("2026-09-15T03:00:00.000Z", 1002.8)]);
    expect(summary.latest?.pressureHpa).toBe(1002.8);
    expect(summary.change3Hours).toBeUndefined();
    expect(summary.change24Hours).toBeUndefined();
  });

  it("uses timestamps across local calendar boundaries rather than array positions", () => {
    const summary = calculatePressureChanges([
      point("2026-09-14T22:00:00.000Z", 1007),
      point("2026-09-15T01:00:00.000Z", 1003.4),
      point("2026-09-14T01:00:00.000Z", 1010),
    ]);
    expect(summary.change3Hours?.changeHpa).toBe(-3.6);
    expect(summary.change24Hours?.changeHpa).toBe(-6.6);
  });

  it("allows only the defined thirty-minute timestamp tolerance", () => {
    const withinTolerance = calculatePressureChanges([
      point("2026-09-15T00:29:00.000Z", 1005),
      point("2026-09-15T03:00:00.000Z", 1002),
    ]);
    expect(withinTolerance.change3Hours?.changeHpa).toBe(-3);
    expect(withinTolerance.change3Hours?.referenceOffsetMs).toBe(29 * 60 * 1000);

    const outsideTolerance = calculatePressureChanges([
      point("2026-09-15T00:31:00.000Z", 1005),
      point("2026-09-15T03:00:00.000Z", 1002),
    ]);
    expect(outsideTolerance.change3Hours).toBeUndefined();
    expect(PRESSURE_REFERENCE_TOLERANCE_MS).toBe(30 * 60 * 1000);
  });

  it("does not combine another location scope or pressure kind into a change", () => {
    const otherLocation = calculatePressureChanges([
      point("2026-09-15T00:00:00.000Z", 1010, { locationScope: "location-b" }),
      point("2026-09-15T03:00:00.000Z", 1004),
    ]);
    expect(otherLocation.change3Hours).toBeUndefined();

    const otherPressureKind = calculatePressureChanges([
      point("2026-09-15T00:00:00.000Z", 1010, { pressureKind: "pressure_msl" }),
      point("2026-09-15T03:00:00.000Z", 1004),
    ]);
    expect(otherPressureKind.change3Hours).toBeUndefined();
  });

  it("ignores invalid points without discarding otherwise valid history", () => {
    const summary = calculatePressureChanges([
      point("not-a-time", 1007),
      point("2026-09-15T00:00:00.000Z", Number.NaN),
      point("2026-09-15T00:00:00.000Z", 1007),
      point("2026-09-15T03:00:00.000Z", 1004),
    ]);
    expect(summary.change3Hours?.changeHpa).toBe(-3);
  });

  it("reports stale and malformed fetched timestamps without inventing a current value", () => {
    expect(isPressureHistoryStale("2026-09-15T00:00:00.000Z", 60 * 60 * 1000, Date.parse("2026-09-15T00:30:00.000Z"))).toBe(false);
    expect(isPressureHistoryStale("2026-09-15T00:00:00.000Z", 60 * 60 * 1000, Date.parse("2026-09-15T02:00:00.000Z"))).toBe(true);
    expect(isPressureHistoryStale("invalid", 60 * 60 * 1000)).toBe(true);
  });

  it("stores a privacy-preserving batch without copying a location scope", () => {
    const batch = createPressureHistoryBatch({
      fetchedAt: "2026-09-15T03:05:00.000Z",
      latestAvailableAt: "2026-09-15T03:00:00.000Z",
      points: [
        point("2026-09-15T00:00:00.000Z", 1005, { locationScope: "location-a" }),
        point("2026-09-15T03:00:00.000Z", 1002, { locationScope: "location-a" }),
      ],
    }, "batch-a");
    expect(batch).toMatchObject({ id: "batch-a", pressureKind: "surface_pressure", source: PRESSURE_HISTORY_SOURCE });
    expect(batch?.points[0]).not.toHaveProperty("locationScope");
    expect(calculatePressureChangesForBatch(batch!).change3Hours?.changeHpa).toBe(-3);
  });

  it("drops broken or expired batches while preserving other stored history", () => {
    const valid = createPressureHistoryBatch({
      fetchedAt: "2026-09-15T03:05:00.000Z",
      latestAvailableAt: "2026-09-15T03:00:00.000Z",
      points: [point("2026-09-15T03:00:00.000Z", 1002)],
    }, "valid");
    const store = normalizePressureHistoryStore({
      schemaVersion: 1,
      batches: [valid, { schemaVersion: 1, id: "broken", points: [] }],
    }, new Date("2026-09-20T00:00:00.000Z"));
    expect(store.batches.map((batch) => batch.id)).toEqual(["valid"]);

    const expired = normalizePressureHistoryStore({ schemaVersion: 1, batches: [valid] }, new Date("2026-10-20T00:00:00.000Z"));
    expect(expired.batches).toEqual([]);
  });

  it("round-trips versioned pressure history JSON and keeps unsupported payloads out", () => {
    const batch = createPressureHistoryBatch({
      fetchedAt: "2026-09-15T03:05:00.000Z",
      latestAvailableAt: "2026-09-15T03:00:00.000Z",
      points: [point("2026-09-15T03:00:00.000Z", 1002)],
    }, "backup-batch");
    const restored = pressureHistoryFromBackupJson(pressureHistoryToBackupJson({ schemaVersion: 1, batches: [batch!] }), new Date("2026-09-16T00:00:00.000Z"));
    expect(restored.batches).toEqual([expect.objectContaining({ id: "backup-batch" })]);
    expect(() => pressureHistoryFromBackupJson(JSON.stringify({ format: "other", version: 1 }))).toThrow("Invalid pressure history backup");
    expect(createPressureHistoryBatchId(1234, 0.5)).toMatch(/^pressure-/);
  });

  it("selects retained points by timestamp for each display period without joining batches", () => {
    const oldBatch = createPressureHistoryBatch({
      fetchedAt: "2026-09-01T12:00:00.000Z",
      latestAvailableAt: "2026-09-01T12:00:00.000Z",
      points: [point("2026-09-01T12:00:00.000Z", 1008)],
    }, "old");
    const weekBatch = createPressureHistoryBatch({
      fetchedAt: "2026-09-18T12:00:00.000Z",
      latestAvailableAt: "2026-09-18T12:00:00.000Z",
      points: [point("2026-09-18T12:00:00.000Z", 1004)],
    }, "week");
    const latestBatch = createPressureHistoryBatch({
      fetchedAt: "2026-09-20T03:00:00.000Z",
      latestAvailableAt: "2026-09-20T03:00:00.000Z",
      points: [
        point("2026-09-19T03:00:00.000Z", 1007),
        point("2026-09-20T00:00:00.000Z", 1005),
        point("2026-09-20T03:00:00.000Z", 1004),
      ],
    }, "latest");
    const batches = [oldBatch!, weekBatch!, latestBatch!];

    const day = selectPressureHistoryPeriod(batches, "day");
    expect(day.days).toBe(1);
    expect(day.batches.map((batch) => batch.id)).toEqual(["latest"]);
    expect(day.pointCount).toBe(3);
    expect(day.latestBatch?.id).toBe("latest");
    expect(calculatePressureChangesForBatch(day.latestBatch!).change3Hours?.changeHpa).toBe(-1);

    const week = selectPressureHistoryPeriod(batches, "week");
    expect(week.days).toBe(7);
    expect(week.batches.map((batch) => batch.id)).toEqual(["week", "latest"]);
    expect(week.pointCount).toBe(4);

    const month = selectPressureHistoryPeriod(batches, "month");
    expect(month.days).toBe(30);
    expect(month.batches.map((batch) => batch.id)).toEqual(["old", "week", "latest"]);
    expect(month.pointCount).toBe(5);
    expect(month.batches).not.toBe(batches);
  });

  it("does not invent a period when no valid retained pressure point exists", () => {
    expect(selectPressureHistoryPeriod([], "month")).toMatchObject({ pointCount: 0, latestBatch: null, startAt: null, endAt: null });
  });

  it("builds newest-first local calendar days and preserves missing dates", () => {
    const batch = createPressureHistoryBatch({
      fetchedAt: "2026-09-20T12:05:00.000Z",
      latestAvailableAt: "2026-09-20T12:00:00.000Z",
      points: [
        point("2026-09-18T12:00:00.000Z", 1008),
        point("2026-09-20T09:00:00.000Z", 1003),
        point("2026-09-20T12:00:00.000Z", 1001.5),
      ],
    }, "calendar-days");

    const days = buildPressureHistoryDays([batch!], "week", new Date("2026-09-20T15:00:00.000Z"));
    expect(days).toHaveLength(7);
    expect(days.map((day) => day.date)).toEqual([
      "2026-09-20", "2026-09-19", "2026-09-18", "2026-09-17", "2026-09-16", "2026-09-15", "2026-09-14",
    ]);
    expect(days[0]).toMatchObject({ pointCount: 2, highestHpa: 1003, lowestHpa: 1001.5, rangeHpa: 1.5 });
    expect(days[1]).toMatchObject({ pointCount: 0, highestHpa: null, lowestHpa: null, rangeHpa: null });
    expect(days[2].pointCount).toBe(1);
  });

  it("keeps same-day batches separate and calculates changes only inside the latest batch", () => {
    const earlier = createPressureHistoryBatch({
      fetchedAt: "2026-09-20T09:05:00.000Z",
      latestAvailableAt: "2026-09-20T09:00:00.000Z",
      points: [point("2026-09-20T06:00:00.000Z", 1012), point("2026-09-20T09:00:00.000Z", 1011)],
    }, "opaque-a");
    const latest = createPressureHistoryBatch({
      fetchedAt: "2026-09-20T12:05:00.000Z",
      latestAvailableAt: "2026-09-20T12:00:00.000Z",
      points: [point("2026-09-20T09:00:00.000Z", 1005), point("2026-09-20T12:00:00.000Z", 1002)],
    }, "opaque-b");

    const [day] = buildPressureHistoryDays([earlier!, latest!], "day", new Date("2026-09-20T15:00:00.000Z"));
    expect(day.batches.map((batch) => batch.id)).toEqual(["opaque-a", "opaque-b"]);
    expect(day.hasSeparatedBatches).toBe(true);
    expect(day.pointCount).toBe(4);
    expect(day).toMatchObject({ summaryPointCount: 2, highestHpa: 1005, lowestHpa: 1002, rangeHpa: 3 });
    expect(day.change3Hours?.changeHpa).toBe(-3);
  });

  it("can use the preceding calendar day as a 3-hour reference without merging the day cards", () => {
    const previousDayAt22 = new Date(2026, 8, 19, 22, 0, 0).toISOString();
    const currentDayAt01 = new Date(2026, 8, 20, 1, 0, 0).toISOString();
    const batch = createPressureHistoryBatch({
      fetchedAt: currentDayAt01,
      latestAvailableAt: currentDayAt01,
      points: [point(previousDayAt22, 1006), point(currentDayAt01, 1002)],
    }, "boundary");

    const days = buildPressureHistoryDays([batch!], "week", new Date(2026, 8, 20, 12, 0, 0));
    expect(days[0]).toMatchObject({ date: "2026-09-20", pointCount: 1 });
    expect(days[0].change3Hours?.changeHpa).toBe(-4);
    expect(days[1]).toMatchObject({ date: "2026-09-19", pointCount: 1 });
    expect(days[0].batches[0].points).toHaveLength(1);
  });

  it("builds thirty compact month rows even when only some dates contain data", () => {
    expect(buildPressureHistoryDays([], "month", new Date("2026-09-20T12:00:00.000Z"))).toHaveLength(30);
    expect(buildPressureHistoryDays([], "day", new Date("invalid"))).toEqual([]);
  });
});
