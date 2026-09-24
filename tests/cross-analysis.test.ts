import { describe, expect, it } from "vitest";

import {
  analyzeSleepConditionComparison,
  type CrossAnalysisQuery,
} from "../lib/cross-analysis";
import { sleepMinutesFromTimes, type SleepRecord } from "../lib/sleep-utils";

function record(date: string, overrides: Partial<SleepRecord> = {}): SleepRecord {
  return {
    id: date,
    date,
    bedTime: "23:30",
    wakeTime: "07:00",
    sleepMinutes: 450,
    sleepDurationDefinition: "actualSleep",
    latencyMinutes: 20,
    napMinutes: 0,
    sleepiness: 4,
    clarity: 7,
    caffeine: false,
    headache: false,
    note: "",
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
    ...overrides,
  };
}

const baseQuery: CrossAnalysisQuery = {
  period: { startDate: "2026-09-01", endDate: "2026-09-30" },
  conditions: [{ id: "short", field: "sleepMinutes", operator: "lt", value: 420 }],
  conditionMatch: "all",
  outcome: "sleepiness",
  alignment: "sameRecord",
};

describe("cross analysis record alignment", () => {
  it("supports current same-record semantics and refuses an unconfirmed next-day join", () => {
    const records = [
      record("2026-09-01", { sleepMinutes: 360, sleepiness: 2 }),
      record("2026-09-02", { sleepMinutes: 480, sleepiness: 8 }),
      record("2026-09-03", { sleepMinutes: 450, sleepiness: 5 }),
    ];

    const sameDay = analyzeSleepConditionComparison(records, baseQuery);
    const nextDay = analyzeSleepConditionComparison(records, { ...baseQuery, alignment: "nextLocalDate" });

    expect(sameDay.groups.matched.observations[0]).toMatchObject({ conditionDate: "2026-09-01", outcomeDate: "2026-09-01", outcomeValue: 2 });
    expect(nextDay).toMatchObject({
      status: "unsupportedAlignment",
      reason: expect.stringContaining("未確定"),
      alignmentEvidence: { recordDateMeaningConfirmed: false },
    });
    expect(nextDay.groups.matched.count).toBe(0);
  });

  it("keeps a sleep crossing midnight attached to its explicit record date", () => {
    const minutes = sleepMinutesFromTimes("23:30", "07:00");
    const result = analyzeSleepConditionComparison([
      record("2026-09-10", { bedTime: "23:30", wakeTime: "07:00", sleepMinutes: minutes! }),
      record("2026-09-11", { sleepMinutes: 360 }),
    ], { ...baseQuery, conditions: [{ id: "long", field: "sleepMinutes", operator: "gte", value: 450 }] });

    expect(result.groups.matched.conditionDates).toEqual(["2026-09-10"]);
    expect(result.groups.matched.observations[0].sleepMinutes).toBe(450);
  });
});

describe("cross analysis condition comparison", () => {
  const records = [
    record("2026-09-01", { sleepMinutes: 360, sleepiness: 8 }),
    record("2026-09-02", { sleepMinutes: 390, sleepiness: 6 }),
    record("2026-09-03", { sleepMinutes: 450, sleepiness: 2 }),
    record("2026-09-04", { sleepMinutes: 480, sleepiness: 0 }),
  ];

  it("separates matching and non-matching valid records and calculates descriptive values", () => {
    const result = analyzeSleepConditionComparison(records, baseQuery);

    expect(result.status).toBe("ready");
    expect(result.groups.matched).toMatchObject({ count: 2, average: 7, median: 7, conditionDates: ["2026-09-01", "2026-09-02"] });
    expect(result.groups.comparison).toMatchObject({ count: 2, average: 1, median: 1, conditionDates: ["2026-09-03", "2026-09-04"] });
    expect(result.averageDifference).toBe(6);
    expect(result.comparisonDefinition).toBe("matched-valid-records-vs-unmatched-valid-records-in-period");
  });

  it("recomputes from source records after conditions are added, removed, or changed", () => {
    const original = analyzeSleepConditionComparison(records, baseQuery);
    const added = analyzeSleepConditionComparison(records, {
      ...baseQuery,
      conditions: [...baseQuery.conditions, { id: "floor", field: "sleepMinutes", operator: "gte", value: 390 }],
    });
    const removed = analyzeSleepConditionComparison(records, { ...baseQuery, conditions: [] });
    const changed = analyzeSleepConditionComparison(records, {
      ...baseQuery,
      conditions: [{ ...baseQuery.conditions[0], value: 380 }],
    });

    expect(original.groups.matched.count).toBe(2);
    expect(added.groups.matched.conditionDates).toEqual(["2026-09-02"]);
    expect(removed.status).toBe("invalidQuery");
    expect(changed.groups.matched.conditionDates).toEqual(["2026-09-01"]);
    expect(original.groups.matched.count).toBe(2);
  });

  it("excludes sample records and records outside the requested period", () => {
    const result = analyzeSleepConditionComparison([
      ...records,
      record("2026-09-05", { isSample: true, sleepMinutes: 300, sleepiness: 10 }),
      record("2026-10-01", { sleepMinutes: 300, sleepiness: 10 }),
    ], baseQuery);

    expect(result.exclusions).toMatchObject({ sampleRecords: 1, outsidePeriod: 1 });
    expect(result.evidence.eligibleRecordCount).toBe(4);
  });

  it("excludes legacy sleep durations without converting them or using their outcomes", () => {
    const result = analyzeSleepConditionComparison([
      record("2026-09-01", { sleepMinutes: 300, sleepiness: 10, sleepDurationDefinition: "legacy" }),
      record("2026-09-02", { sleepMinutes: 360, sleepiness: 8 }),
      record("2026-09-03", { sleepMinutes: 480, sleepiness: 2 }),
    ], baseQuery);

    expect(result.exclusions).toMatchObject({ legacySleepDuration: 1, invalidSleepMinutes: 0 });
    expect(result.evidence.usedConditionDates).toEqual(["2026-09-02", "2026-09-03"]);
    expect(result.groups.matched.observations).toEqual([expect.objectContaining({ sleepMinutes: 360, outcomeValue: 8 })]);
  });

  it("reports no eligible records when the selected period contains legacy sleep only", () => {
    const result = analyzeSleepConditionComparison([
      record("2026-09-01", { sleepMinutes: 510, sleepiness: 4, sleepDurationDefinition: "legacy" }),
    ], baseQuery);

    expect(result).toMatchObject({ status: "noEligibleRecords", exclusions: { legacySleepDuration: 1 }, averageDifference: null });
    expect(result.groups.matched.count).toBe(0);
    expect(result.groups.comparison.count).toBe(0);
  });

  it("keeps a recorded zero outcome but excludes an absent optional outcome", () => {
    const result = analyzeSleepConditionComparison([
      record("2026-09-01", { sleepMinutes: 360, fatigue: 0 }),
      record("2026-09-02", { sleepMinutes: 480 }),
      record("2026-09-03", { sleepMinutes: 480, fatigue: 6 }),
    ], { ...baseQuery, outcome: "fatigue" });

    expect(result.groups.matched.observations[0].outcomeValue).toBe(0);
    expect(result.groups.comparison.observations[0].outcomeValue).toBe(6);
    expect(result.exclusions.missingOutcome).toBe(1);
  });

  it("keeps a daily no-headache value as zero instead of treating it as missing", () => {
    const result = analyzeSleepConditionComparison([
      record("2026-09-01", { sleepMinutes: 360, headache: false, headacheIntensity: 0 }),
      record("2026-09-02", { sleepMinutes: 480, headache: true, headacheIntensity: 6 }),
    ], { ...baseQuery, outcome: "dailyHeadache" });

    expect(result).toMatchObject({ status: "ready", averageDifference: -6, exclusions: { missingOutcome: 0 } });
    expect(result.groups.matched.observations[0].outcomeValue).toBe(0);
  });

  it("reports an absent comparison group", () => {
    const noComparison = analyzeSleepConditionComparison([
      record("2026-09-01", { sleepMinutes: 360 }),
      record("2026-09-02", { sleepMinutes: 390 }),
    ], baseQuery);

    expect(noComparison).toMatchObject({ status: "noComparisonRecords", averageDifference: null });
  });

  it("is deterministic when input order changes", () => {
    const forward = analyzeSleepConditionComparison(records, baseQuery);
    const reversed = analyzeSleepConditionComparison([...records].reverse(), baseQuery);
    expect(reversed).toEqual(forward);
  });

  it("does not turn a small descriptive difference into a trend claim", () => {
    const result = analyzeSleepConditionComparison([
      record("2026-09-01", { sleepMinutes: 360, sleepiness: 8 }),
      record("2026-09-02", { sleepMinutes: 480, sleepiness: 2 }),
    ], baseQuery);

    expect(result.averageDifference).toBe(6);
    expect(result.evidence).toMatchObject({ minimumGroupSize: null, inference: "not-assessed" });
    expect(result.evidence.limitations.join(" ")).toContain("統計的推論は行わない");
  });
});
