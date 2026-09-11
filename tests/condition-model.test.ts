import { describe, expect, it } from "vitest";

import {
  dailyConditionFromSleepRecord,
  dailyConditionsFromSleepRecords,
} from "../lib/condition-model";
import type { SleepRecord } from "../lib/sleep-utils";

function sleepRecord(overrides: Partial<SleepRecord> = {}): SleepRecord {
  return {
    id: "2026-09-09",
    date: "2026-09-09",
    bedTime: "23:30",
    wakeTime: "07:00",
    sleepMinutes: 450,
    latencyMinutes: 20,
    napMinutes: 0,
    sleepiness: 4,
    clarity: 7,
    caffeine: true,
    headache: false,
    note: "よく眠れた",
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T01:00:00.000Z",
    ...overrides,
  };
}

describe("daily condition compatibility model", () => {
  it("adapts every existing sleep field without changing the legacy record", () => {
    const legacy = sleepRecord();
    const snapshot = structuredClone(legacy);

    expect(dailyConditionFromSleepRecord(legacy)).toEqual({
      date: "2026-09-09",
      sleep: {
        source: "manual",
        bedTime: "23:30",
        wakeTime: "07:00",
        sleepMinutes: 450,
        latencyMinutes: 20,
        napMinutes: 0,
      },
      nutrition: { source: "manual", caffeineConsumed: true, caffeineTime: undefined, caffeineNote: undefined },
      subjective: {
        source: "manual",
        sleepiness: 4,
        clarity: 7,
        headache: false,
        headacheIntensity: undefined,
        headacheFeatures: undefined,
      },
      note: "よく眠れた",
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T01:00:00.000Z",
    });
    expect(legacy).toEqual(snapshot);
  });

  it("keeps the app's newest-first date ordering", () => {
    const records = [
      sleepRecord({ id: "2026-09-08", date: "2026-09-08" }),
      sleepRecord({ id: "2026-09-10", date: "2026-09-10" }),
      sleepRecord(),
    ];

    expect(dailyConditionsFromSleepRecords(records).map((record) => record.date)).toEqual([
      "2026-09-10",
      "2026-09-09",
      "2026-09-08",
    ]);
  });

  it("keeps empty notes optional in the new model", () => {
    expect(dailyConditionFromSleepRecord(sleepRecord({ note: "" })).note).toBeUndefined();
  });

  it("maps an optional weather snapshot without coordinates", () => {
    const condition = dailyConditionFromSleepRecord(sleepRecord({
      weather: { pressureHpa: 1001.5, temperatureC: 25.2, condition: "晴れ", weatherCode: 1, fetchedAt: "2026-09-09T04:00:00.000Z", source: "Open-Meteo" },
    }));

    expect(condition.environment).toEqual({
      source: "api",
      pressureHpa: 1001.5,
      weather: "晴れ",
      temperatureCelsius: 25.2,
      weatherCode: 1,
      fetchedAt: "2026-09-09T04:00:00.000Z",
      provider: "Open-Meteo",
    });
    expect(condition.environment).not.toHaveProperty("latitude");
  });
});
