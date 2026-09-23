import { describe, expect, it } from "vitest";

import { analyzeSleepConditionComparison, type CrossAnalysisQuery } from "../lib/cross-analysis";
import { recordsFromCsv, recordsToCsv } from "../lib/csv-core";
import { buildTrend } from "../lib/condition-analysis";
import { actualSleepMinutesFromTimes, normalizeSleepRecord, timeInBedMinutesFromTimes, type SleepRecord } from "../lib/sleep-utils";

function record(overrides: Partial<SleepRecord> = {}): SleepRecord {
  return {
    id: "2026-09-22",
    date: "2026-09-22",
    bedTime: "23:30",
    wakeTime: "08:00",
    sleepMinutes: 510,
    latencyMinutes: 30,
    napMinutes: 20,
    sleepiness: 4,
    clarity: 7,
    caffeine: false,
    headache: false,
    note: "",
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
    ...overrides,
  };
}

const query: CrossAnalysisQuery = {
  period: { startDate: "2026-09-01", endDate: "2026-09-30" },
  conditions: [{ id: "sleep", field: "sleepMinutes", operator: "gte", value: 480 }],
  conditionMatch: "all",
  outcome: "sleepiness",
  alignment: "sameRecord",
};

describe("time in bed and actual sleep definitions", () => {
  it("keeps time in bed separate from actual sleep across midnight", () => {
    expect(timeInBedMinutesFromTimes("23:30", "08:00")).toBe(510);
    expect(actualSleepMinutesFromTimes("23:30", "08:00", 30)).toBe(480);
    expect(actualSleepMinutesFromTimes("23:30", "08:00", undefined)).toBeNull();
  });

  it("preserves an actual-sleep record through storage, CSV, detailed analysis, and cross analysis", () => {
    const saved = normalizeSleepRecord(record({ sleepMinutes: 480, sleepDurationDefinition: "actualSleep" }));
    expect(saved).not.toBeNull();
    expect(saved).toMatchObject({ sleepMinutes: 480, sleepDurationDefinition: "actualSleep", latencyMinutes: 30, napMinutes: 20 });

    const reloadedFromStorage = normalizeSleepRecord(JSON.parse(JSON.stringify(saved)));
    expect(reloadedFromStorage).toMatchObject({ sleepMinutes: 480, sleepDurationDefinition: "actualSleep", latencyMinutes: 30, napMinutes: 20 });

    const reloaded = recordsFromCsv(recordsToCsv([reloadedFromStorage!]));
    expect(reloaded[0]).toMatchObject({ sleepMinutes: 480, sleepDurationDefinition: "actualSleep", latencyMinutes: 30, napMinutes: 20 });

    expect(buildTrend(reloaded, "sleepMinutes", "day")).toEqual([
      expect.objectContaining({ key: "2026-09-22", value: 480 }),
    ]);
    expect(analyzeSleepConditionComparison(reloaded, query).groups.matched.observations).toEqual([
      expect.objectContaining({ sleepMinutes: 480, outcomeValue: 4 }),
    ]);
  });

  it("does not rewrite or double-subtract an existing legacy record", () => {
    const legacy = normalizeSleepRecord(record({ sleepMinutes: 510, latencyMinutes: 30 }));
    expect(legacy).toMatchObject({ sleepMinutes: 510, sleepDurationDefinition: "legacy", latencyMinutes: 30 });
    expect(buildTrend([legacy!], "sleepMinutes", "day")[0]).toMatchObject({ value: 510 });
  });

  it("keeps a missing latency distinct from a recorded zero", () => {
    expect(normalizeSleepRecord(record({ latencyMinutes: undefined }))).toMatchObject({ sleepDurationDefinition: "legacy" });
    expect(normalizeSleepRecord(record({ latencyMinutes: undefined }))).not.toHaveProperty("latencyMinutes");
    expect(normalizeSleepRecord(record({ latencyMinutes: 0 }))).toMatchObject({ latencyMinutes: 0 });
  });
});
