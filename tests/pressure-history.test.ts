import { describe, expect, it } from "vitest";

import {
  calculatePressureChanges,
  isPressureHistoryStale,
  PRESSURE_HISTORY_SOURCE,
  PRESSURE_REFERENCE_TOLERANCE_MS,
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
});
