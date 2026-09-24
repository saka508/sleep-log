import { describe, expect, it } from "vitest";

import { buildHomeComparison, HOME_BASELINE_MIN_RECORDS } from "../lib/home-summary";
import type { SleepRecord } from "../lib/sleep-utils";

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
    sleepiness: 3,
    clarity: 8,
    caffeine: false,
    headache: false,
    note: "",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("home comparison", () => {
  it("uses the median from the previous 30 local days and excludes today", () => {
    const result = buildHomeComparison([
      record("2026-09-10", { sleepMinutes: 420, fatigue: 2 }),
      record("2026-09-11", { sleepMinutes: 450, fatigue: 4 }),
      record("2026-09-12", { sleepMinutes: 480, fatigue: 8 }),
      record("2026-09-13", { sleepMinutes: 300, fatigue: 10 }),
    ], "2026-09-13");

    expect(result).toMatchObject({ baselineStart: "2026-08-14", baselineEnd: "2026-09-12" });
    expect(result.rows[0]).toMatchObject({ usual: "7時間30分", today: "5時間", validDays: 3 });
    expect(result.rows[1]).toMatchObject({ usual: "4.0 / 10", today: "10 / 10", validDays: 3 });
  });

  it("does not mix sample records into the baseline or today", () => {
    const samples = Array.from({ length: HOME_BASELINE_MIN_RECORDS }, (_, index) =>
      record(`2026-09-${String(index + 9).padStart(2, "0")}`, { isSample: true, sleepMinutes: 300, fatigue: 9 }),
    );
    const result = buildHomeComparison([...samples, record("2026-09-13", { isSample: true })], "2026-09-13");

    expect(result.rows[0]).toMatchObject({ usual: "データ不足", today: "記録なし", validDays: 0 });
    expect(result.rows[1]).toMatchObject({ usual: "データ不足", today: "未記録", validDays: 0 });
  });

  it("uses actual sleep only for the home sleep comparison while retaining other metrics", () => {
    const result = buildHomeComparison([
      record("2026-09-10", { sleepMinutes: 900, sleepDurationDefinition: "legacy", fatigue: 2 }),
      record("2026-09-11", { sleepMinutes: 420, fatigue: 4 }),
      record("2026-09-12", { sleepMinutes: 480, fatigue: 6 }),
      record("2026-09-13", { sleepMinutes: 510, sleepDurationDefinition: "legacy", fatigue: 8 }),
    ], "2026-09-13", { minimumRecords: 2 });

    expect(result.rows[0]).toMatchObject({ usual: "7時間30分", today: "記録なし", validDays: 2 });
    expect(result.rows[1]).toMatchObject({ usual: "4.0 / 10", today: "8 / 10", validDays: 3 });
    expect(result.excludedLegacySleepRecords).toBe(1);
  });

  it("keeps fatigue zero and missing fatigue distinct", () => {
    const result = buildHomeComparison([
      record("2026-09-10", { fatigue: 0 }),
      record("2026-09-11"),
      record("2026-09-12", { fatigue: 4 }),
      record("2026-09-13", { fatigue: 0 }),
    ], "2026-09-13");

    expect(result.rows[1]).toMatchObject({ usual: "データ不足", today: "0 / 10", validDays: 2 });
  });

  it("does not invent exercise or recovery values", () => {
    const result = buildHomeComparison([record("2026-09-12")], "2026-09-13");
    expect(result.rows.slice(2)).toEqual([
      expect.objectContaining({ key: "exercise", usual: "未対応", today: "未対応", supported: false }),
      expect.objectContaining({ key: "recovery", usual: "未対応", today: "未対応", supported: false }),
    ]);
  });
});
