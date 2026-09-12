import { describe, expect, it } from "vitest";

import { analyzeRelation, assessAnalysisQuality, buildSleepRecommendation, buildTrend, MIN_RECOMMENDATION_RECORDS, summarizeTrend } from "../lib/condition-analysis";
import type { SleepRecord } from "../lib/sleep-utils";

function record(date: string, overrides: Partial<SleepRecord> = {}): SleepRecord {
  return {
    id: date, date, bedTime: "23:30", wakeTime: "07:00", sleepMinutes: 450, latencyMinutes: 20, napMinutes: 0,
    sleepiness: 3, clarity: 8, caffeine: false, caffeineTime: "", caffeineNote: "", headache: false, headacheIntensity: 0,
    headacheFeatures: [], note: "", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", ...overrides,
  };
}

describe("condition analysis trends", () => {
  it("excludes sample records from a personal trend", () => {
    const trend = buildTrend([
      record("2026-09-01", { isSample: true, sleepMinutes: 300 }),
      record("2026-09-02", { sleepMinutes: 450 }),
    ], "sleepMinutes", "day");

    expect(trend).toEqual([expect.objectContaining({ key: "2026-09-02", value: 450 })]);
  });

  it("keeps missing pressure as null instead of fabricating zero", () => {
    const trend = buildTrend([record("2026-09-01"), record("2026-09-02", { weather: { pressureHpa: 1002, temperatureC: 22, condition: "曇り", weatherCode: 3, fetchedAt: "2026-09-02T00:00:00.000Z", source: "Open-Meteo" } })], "pressureHpa", "day");
    expect(trend.map((point) => point.value)).toEqual([null, 1002]);
    expect(summarizeTrend(trend)).toMatchObject({ dataDays: 1, average: 1002, median: 1002 });
  });

  it("uses local calendar weeks and averages only present values", () => {
    const trend = buildTrend([record("2026-09-07", { napMinutes: 0 }), record("2026-09-08", { napMinutes: 30 })], "napMinutes", "week");
    expect(trend).toHaveLength(1);
    expect(trend.map((point) => point.value)).toEqual([15]);
  });

  it("includes recorded fatigue zero but leaves absent fatigue as missing", () => {
    const records = [
      record("2026-09-01", { fatigue: 0, muscleFatigue: 0 }),
      record("2026-09-02", { fatigue: 6, muscleFatigue: 8 }),
      record("2026-09-03"),
      record("2026-09-04", { isSample: true, fatigue: 10, muscleFatigue: 10 }),
    ];

    expect(buildTrend(records, "fatigue", "day").map((point) => point.value)).toEqual([0, 6, null]);
    expect(buildTrend(records, "muscleFatigue", "week")).toEqual([expect.objectContaining({ value: 4 })]);
    expect(summarizeTrend(buildTrend(records, "fatigue", "day"))).toMatchObject({ average: 3, median: 3, dataDays: 2 });
  });

  it("reaggregates muscle fatigue for day, week, and month without changing recorded zero", () => {
    const records = [
      record("2026-09-07", { muscleFatigue: 0 }),
      record("2026-09-08", { muscleFatigue: 4 }),
      record("2026-10-01", { muscleFatigue: 8 }),
    ];

    expect(buildTrend(records, "muscleFatigue", "day").map((point) => point.value)).toEqual([0, 4, 8]);
    expect(buildTrend(records, "muscleFatigue", "week").map((point) => point.value)).toEqual([2, 8]);
    expect(buildTrend(records, "muscleFatigue", "month").map((point) => point.value)).toEqual([2, 8]);
  });
});

describe("condition analysis relations", () => {
  it("does not count sample records as complete relation pairs", () => {
    const personal = Array.from({ length: 4 }, (_, index) => record(`2026-09-0${index + 1}`, { sleepiness: index + 2 }));
    const sample = record("2026-09-05", { isSample: true, sleepiness: 9 });

    expect(analyzeRelation([...personal, sample], "sleepSleepiness")).toMatchObject({
      status: "insufficient",
      pairedCount: 4,
    });
  });

  it("reports insufficient data rather than a correlation for fewer than five complete pairs", () => {
    const result = analyzeRelation([record("2026-09-01"), record("2026-09-02"), record("2026-09-03")], "sleepSleepiness");
    expect(result).toMatchObject({ status: "insufficient", pairedCount: 3, coefficient: null });
  });

  it("does not calculate a relation when all values are the same", () => {
    const records = Array.from({ length: 5 }, (_, index) => record(`2026-09-0${index + 1}`, { sleepMinutes: 450, sleepiness: index + 1 }));
    expect(analyzeRelation(records, "sleepSleepiness")).toMatchObject({ status: "constant", pairedCount: 5, coefficient: null });
  });

  it("uses only consecutive days with pressure data for pressure-change comparisons", () => {
    const weather = (pressureHpa: number) => ({ pressureHpa, temperatureC: 22, condition: "曇り", weatherCode: 3, fetchedAt: "2026-09-01T00:00:00.000Z", source: "Open-Meteo" as const });
    const result = analyzeRelation([
      record("2026-09-01", { weather: weather(1000) }),
      record("2026-09-02", { weather: weather(1002), headache: true, headacheIntensity: 3 }),
      record("2026-09-04", { weather: weather(999), headache: true, headacheIntensity: 5 }),
    ], "pressureChangeHeadache");
    expect(result).toMatchObject({ status: "insufficient", pairedCount: 1 });
  });
});

describe("sleep reference values", () => {
  it("uses medians from at least seven qualifying personal records", () => {
    const records = Array.from({ length: MIN_RECOMMENDATION_RECORDS }, (_, index) => record(`2026-09-${String(index + 1).padStart(2, "0")}`, { sleepMinutes: 440 + index * 2, bedTime: "23:20", wakeTime: "07:00" }));
    expect(buildSleepRecommendation(records)).toMatchObject({ status: "ready", qualifyingDays: MIN_RECOMMENDATION_RECORDS, targetSleepMinutes: 446, bedTime: "23:20", wakeTime: "07:00" });
  });

  it("does not use sample data or surface a short historical median", () => {
    const samples = Array.from({ length: MIN_RECOMMENDATION_RECORDS }, (_, index) => record(`2026-09-${String(index + 1).padStart(2, "0")}`, { isSample: true }));
    expect(buildSleepRecommendation(samples)).toMatchObject({ status: "insufficient", qualifyingDays: 0 });
    const short = Array.from({ length: MIN_RECOMMENDATION_RECORDS }, (_, index) => record(`2026-08-${String(index + 1).padStart(2, "0")}`, { sleepMinutes: 360 }));
    expect(buildSleepRecommendation(short)).toMatchObject({ status: "tooShort", targetSleepMinutes: 360 });
  });
});

describe("analysis data quality", () => {
  const relationsFor = (records: SleepRecord[]) => [analyzeRelation(records, "sleepSleepiness")];

  it("keeps sample records in the total while excluding them from personal analysis", () => {
    const records = [record("2026-09-01", { isSample: true }), record("2026-09-02")];
    expect(assessAnalysisQuality(records, "sleepMinutes", "day", relationsFor(records))).toMatchObject({
      totalRecords: 2, personalRecords: 1, excludedSampleRecords: 1, validMetricRecords: 1, missingMetricRecords: 0, status: "reference",
    });
  });

  it("counts missing selected-metric values without treating them as zero", () => {
    const records = [record("2026-09-01"), record("2026-09-02"), record("2026-09-03", { weather: { pressureHpa: 1001, temperatureC: 22, condition: "曇り", weatherCode: 3, fetchedAt: "2026-09-03T00:00:00.000Z", source: "Open-Meteo" } })];
    expect(assessAnalysisQuality(records, "pressureHpa", "day", relationsFor(records))).toMatchObject({
      personalRecords: 3, validMetricRecords: 1, missingMetricRecords: 2, status: "reference",
    });
  });

  it("uses fatigue and muscle fatigue values in quality metadata without including samples", () => {
    const records = [
      record("2026-09-01", { fatigue: 0, muscleFatigue: 0 }),
      record("2026-09-02", { fatigue: 4 }),
      record("2026-09-03", { isSample: true, fatigue: 9, muscleFatigue: 9 }),
    ];

    expect(assessAnalysisQuality(records, "fatigue", "day", relationsFor(records))).toMatchObject({
      totalRecords: 3, personalRecords: 2, excludedSampleRecords: 1, validMetricRecords: 2, missingMetricRecords: 0, status: "reference",
    });
    expect(assessAnalysisQuality(records, "muscleFatigue", "day", relationsFor(records))).toMatchObject({
      totalRecords: 3, personalRecords: 2, excludedSampleRecords: 1, validMetricRecords: 1, missingMetricRecords: 1, status: "reference",
    });
  });

  it("reports existing relation pair counts and recomputes period groups", () => {
    const records = [record("2026-09-07"), record("2026-09-08")];
    const day = assessAnalysisQuality(records, "sleepMinutes", "day", relationsFor(records));
    const week = assessAnalysisQuality(records, "sleepMinutes", "week", relationsFor(records));
    const month = assessAnalysisQuality(records, "sleepMinutes", "month", relationsFor(records));
    expect(day).toMatchObject({ periodGroups: 2, validPeriodGroups: 2 });
    expect(week).toMatchObject({ periodGroups: 1, validPeriodGroups: 1 });
    expect(month).toMatchObject({ periodGroups: 1, validPeriodGroups: 1 });
    expect(day.relationPairs[0]).toMatchObject({ pairedCount: 2 });
  });

  it("does not change existing trend results while calculating quality metadata", () => {
    const records = [record("2026-09-01"), record("2026-09-02", { sleepMinutes: 420 })];
    const before = buildTrend(records, "sleepMinutes", "day");
    assessAnalysisQuality(records, "sleepMinutes", "day", relationsFor(records));
    expect(buildTrend(records, "sleepMinutes", "day")).toEqual(before);
  });

  it("handles no records, only samples, and all missing values", () => {
    expect(assessAnalysisQuality([], "sleepMinutes", "day", [])).toMatchObject({ status: "empty", totalRecords: 0 });
    const samples = [record("2026-09-01", { isSample: true })];
    expect(assessAnalysisQuality(samples, "sleepMinutes", "day", relationsFor(samples))).toMatchObject({ status: "empty", excludedSampleRecords: 1 });
    const missing = [record("2026-09-01"), record("2026-09-02")];
    expect(assessAnalysisQuality(missing, "pressureHpa", "day", relationsFor(missing))).toMatchObject({ status: "insufficient", validMetricRecords: 0, missingMetricRecords: 2 });
  });
});
