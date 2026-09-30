import { describe, expect, it } from "vitest";

import { recordsFromCsv, recordsToCsv } from "../lib/csv-core";
import {
  clockValueForChart,
  correlation,
  createSampleRecords,
  daysFromToday,
  formatDuration,
  getMetricValue,
  getSleepStats,
  normalizeSleepRecord,
  sleepMinutesFromTimes,
  timeToMinutes,
  todayKey,
  type SleepRecord,
} from "../lib/sleep-utils";

describe("sleep time calculation", () => {
  it("calculates sleep across midnight", () => {
    expect(sleepMinutesFromTimes("23:30", "07:00")).toBe(450);
    expect(sleepMinutesFromTimes("00:20", "06:55")).toBe(395);
  });

  it("validates clock input", () => {
    expect(timeToMinutes("07:05")).toBe(425);
    expect(timeToMinutes("24:00")).toBeNull();
    expect(timeToMinutes("7:99")).toBeNull();
  });

  it("formats duration for prominent display", () => {
    expect(formatDuration(430, true)).toBe("7時間10分");
    expect(formatDuration(480, true)).toBe("8時間");
  });
});

describe("analysis data helpers", () => {
  it("normalizes after-midnight bedtimes for a continuous chart", () => {
    expect(clockValueForChart("23:30", true)).toBe(1410);
    expect(clockValueForChart("00:30", true)).toBe(1470);
    expect(clockValueForChart("07:00")).toBe(420);
  });

  it("calculates a Pearson correlation when enough points exist", () => {
    expect(correlation([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }])).toBeCloseTo(1);
    expect(correlation([{ x: 1, y: 3 }, { x: 2, y: 2 }, { x: 3, y: 1 }])).toBeCloseTo(-1);
    expect(correlation([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toBeNull();
  });

  it("keeps legacy duration values out of generic actual-sleep helpers", () => {
    const base = {
      id: "2026-09-01", date: "2026-09-01", bedTime: "23:30", wakeTime: "07:00", sleepMinutes: 450,
      caffeine: false, headache: false, note: "", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
    };
    const legacy: SleepRecord = { ...base, sleepMinutes: 900, sleepDurationDefinition: "legacy" };
    const actual: SleepRecord = { ...base, id: "2026-09-02", date: "2026-09-02", sleepMinutes: 420, sleepDurationDefinition: "actualSleep" };
    const sample: SleepRecord = { ...base, id: "2026-09-03", date: "2026-09-03", sleepMinutes: 300, sleepDurationDefinition: "actualSleep", isSample: true };

    expect(getMetricValue(legacy, "sleepMinutes")).toBeUndefined();
    expect(getMetricValue(actual, "sleepMinutes")).toBe(420);
    expect(getSleepStats([legacy, actual, sample]).averageSleepMinutes).toBe(420);
  });

  it("creates a descending date-safe sample set", () => {
    const samples = createSampleRecords();
    expect(samples).toHaveLength(12);
    expect(new Set(samples.map((record) => record.date)).size).toBe(12);
    expect(samples.every((record) => record.isSample)).toBe(true);
  });

  it("stops sample data at yesterday so today still reads as 未記録", () => {
    const dates = createSampleRecords().map((record) => record.date);
    expect(dates).not.toContain(todayKey());
    expect(dates.at(-1)).toBe(daysFromToday(-1));
    expect(dates.at(0)).toBe(daysFromToday(-12));
  });

  it("builds the recent-days window on the local calendar", () => {
    // The home screen compares record.date against daysFromToday(-6); a UTC
    // boundary would slide this by a day for most of the day in JST.
    const start = daysFromToday(-6);
    const window = Array.from({ length: 7 }, (_, index) => daysFromToday(index - 6));
    expect(window[0]).toBe(start);
    expect(window.at(-1)).toBe(todayKey());
    expect(window.filter((day) => day >= start && day <= todayKey())).toHaveLength(7);
  });
});

describe("CSV import and export", () => {
  it("round-trips Japanese notes, flags, and comma-delimited memo text", () => {
    const csv = recordsToCsv([{
      id: "2026-09-09",
      date: "2026-09-09",
      bedTime: "23:30",
      wakeTime: "07:00",
      sleepMinutes: 450,
      latencyMinutes: 20,
      napMinutes: 15,
      sleepiness: 4,
      fatigue: 0,
      clarity: 7,
      muscleFatigue: 8,
      caffeine: true,
      caffeineTime: "14:30",
      caffeineNote: "コーヒー 1杯",
      headache: true,
      headacheIntensity: 6,
      headacheFeatures: ["oneSide", "nausea", "lightOrSound"],
      weather: {
        pressureHpa: 1004.2,
        temperatureC: 26.8,
        condition: "曇り",
        weatherCode: 3,
        fetchedAt: "2026-09-09T05:30:00.000Z",
        source: "Open-Meteo",
      },
      note: "部活のあと、少し休憩",
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
    }]);
    const parsed = recordsFromCsv(csv);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      date: "2026-09-09",
      sleepMinutes: 450,
      fatigue: 0,
      muscleFatigue: 8,
      caffeine: true,
      caffeineTime: "14:30",
      caffeineNote: "コーヒー 1杯",
      headache: true,
      headacheIntensity: 6,
      headacheFeatures: ["oneSide", "nausea", "lightOrSound"],
      weather: {
        pressureHpa: 1004.2,
        temperatureC: 26.8,
        condition: "曇り",
        weatherCode: 3,
        fetchedAt: "2026-09-09T05:30:00.000Z",
        source: "Open-Meteo",
      },
      note: "部活のあと、少し休憩",
    });
    expect(csv).toContain("片側／吐き気／光や音がつらい");
    expect(csv.split("\n")[0]).toContain("天候データ提供元");
    expect(csv.split("\n")[0]).toMatch(/疲労（0-10）,筋肉疲労（0-10）,睡眠時間の定義$/);
  });

  it("imports a Phase 1 CSV without manufacturing optional scores", () => {
    const legacyCsv = "日付,就寝時刻,起床時刻,実睡眠時間（分）,寝つくまで（分）,昼寝時間（分）,眠気（0-10）,頭の冴え（0-10）,カフェイン,頭痛,メモ\n2026-09-08,23:45,07:10,425,15,0,3,8,なし,なし,旧形式";

    expect(recordsFromCsv(legacyCsv)[0]).toMatchObject({
      date: "2026-09-08",
      caffeineTime: "", caffeineNote: "", headacheIntensity: 0, headacheFeatures: [],
      note: "旧形式",
    });
    expect(recordsFromCsv(legacyCsv)[0]).not.toHaveProperty("fatigue");
    expect(recordsFromCsv(legacyCsv)[0]).not.toHaveProperty("muscleFatigue");
    expect(recordsFromCsv(legacyCsv)[0]).toMatchObject({ napMinutes: 0, sleepiness: 3, clarity: 8 });
  });
});

describe("stored record compatibility", () => {
  it("treats only finite numbers or nonblank numeric strings as optional observations", () => {
    const base = {
      id: "2026-09-05", date: "2026-09-05", bedTime: "23:30", wakeTime: "07:00", sleepMinutes: 450,
      caffeine: false, headache: false, note: "", createdAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z",
    };
    const structurallyInvalidValues = [undefined, null, "", "   ", false, true, [], {}, Number.NaN];

    structurallyInvalidValues.forEach((invalid) => {
      const normalized = normalizeSleepRecord({ ...base, napMinutes: invalid, sleepiness: invalid, clarity: invalid } as unknown as Partial<SleepRecord>)!;
      expect(normalized).not.toHaveProperty("napMinutes");
      expect(normalized).not.toHaveProperty("sleepiness");
      expect(normalized).not.toHaveProperty("clarity");
    });
    const outOfRangeScore = normalizeSleepRecord({ ...base, napMinutes: -1, sleepiness: 11, clarity: 10.5 })!;
    expect(outOfRangeScore).not.toHaveProperty("napMinutes");
    expect(outOfRangeScore).not.toHaveProperty("sleepiness");
    expect(outOfRangeScore).not.toHaveProperty("clarity");
    const tooLongNap = normalizeSleepRecord({ ...base, napMinutes: 24 * 60 + 1 })!;
    expect(tooLongNap).not.toHaveProperty("napMinutes");
    expect(normalizeSleepRecord({ ...base, napMinutes: "0", sleepiness: "0", clarity: 0 } as unknown as Partial<SleepRecord>)).toMatchObject({ napMinutes: 0, sleepiness: 0, clarity: 0 });
  });

  it("keeps missing sleepiness, clarity, and nap duration out of the normalized record while preserving explicit zero", () => {
    const base = {
      id: "2026-09-06", date: "2026-09-06", bedTime: "23:30", wakeTime: "07:00", sleepMinutes: 450,
      caffeine: false, headache: false, note: "", createdAt: "2026-09-06T00:00:00.000Z", updatedAt: "2026-09-06T00:00:00.000Z",
    };
    const missing = normalizeSleepRecord({ ...base, napMinutes: "", sleepiness: null, clarity: "invalid" } as unknown as Partial<SleepRecord>);
    const zero = normalizeSleepRecord({ ...base, napMinutes: 0, sleepiness: 0, clarity: 0 });

    expect(missing).not.toHaveProperty("napMinutes");
    expect(missing).not.toHaveProperty("sleepiness");
    expect(missing).not.toHaveProperty("clarity");
    expect(zero).toMatchObject({ napMinutes: 0, sleepiness: 0, clarity: 0 });
  });

  it("keeps blank or invalid optional values missing while retaining explicit zero", () => {
    const csv = [
      "日付,就寝時刻,起床時刻,実睡眠時間（分）,寝つくまで（分）,昼寝時間（分）,眠気（0-10）,頭の冴え（0-10）,カフェイン,頭痛,メモ",
      "2026-09-08,23:45,07:10,425,,,0,,なし,なし,空欄",
      "2026-09-09,23:45,07:10,425,,invalid,12,-1,なし,なし,不正値",
    ].join("\n");
    const [blank, invalid] = recordsFromCsv(csv);

    expect(blank).toMatchObject({ sleepiness: 0 });
    expect(blank).not.toHaveProperty("napMinutes");
    expect(blank).not.toHaveProperty("clarity");
    expect(invalid).not.toHaveProperty("napMinutes");
    expect(invalid).not.toHaveProperty("sleepiness");
    expect(invalid).not.toHaveProperty("clarity");
  });

  it("does not expose an empty optional metric as an observed zero", () => {
    const missing = normalizeSleepRecord({
      id: "2026-09-10", date: "2026-09-10", bedTime: "23:30", wakeTime: "07:00", sleepMinutes: 450,
      caffeine: false, headache: false, note: "", createdAt: "2026-09-10T00:00:00.000Z", updatedAt: "2026-09-10T00:00:00.000Z",
    })!;
    const zero = normalizeSleepRecord({ ...missing, id: "2026-09-11", date: "2026-09-11", napMinutes: 0, sleepiness: 0, clarity: 0 })!;

    expect(getSleepStats([missing])).toMatchObject({ averageSleepiness: null, averageClarity: null, napDays: 0 });
    expect(getSleepStats([zero])).toMatchObject({ averageSleepiness: 0, averageClarity: 0, napDays: 0 });
    const [reloadedMissing, reloadedZero] = recordsFromCsv(recordsToCsv([missing, zero]));
    expect(reloadedMissing).not.toHaveProperty("napMinutes");
    expect(reloadedMissing).not.toHaveProperty("sleepiness");
    expect(reloadedMissing).not.toHaveProperty("clarity");
    expect(reloadedZero).toMatchObject({ napMinutes: 0, sleepiness: 0, clarity: 0 });
  });

  it("normalizes a record saved before the detailed fields existed", () => {
    const normalized = normalizeSleepRecord({
      id: "2026-09-07", date: "2026-09-07", bedTime: "00:10", wakeTime: "07:00",
      sleepMinutes: 390, latencyMinutes: 25, napMinutes: 0, sleepiness: 5, clarity: 6,
      caffeine: false, headache: false, note: "旧データ",
      createdAt: "2026-09-07T00:00:00.000Z", updatedAt: "2026-09-07T00:00:00.000Z",
    });

    expect(normalized).toMatchObject({
      caffeineTime: "", caffeineNote: "", headacheIntensity: 0, headacheFeatures: [],
    });
    expect(normalized).not.toHaveProperty("fatigue");
    expect(normalized).not.toHaveProperty("muscleFatigue");
  });

  it("preserves valid detailed fields through JSON storage", () => {
    const stored = JSON.parse(JSON.stringify({
      id: "2026-09-09", date: "2026-09-09", bedTime: "23:30", wakeTime: "07:00",
      sleepMinutes: 450, latencyMinutes: 20, napMinutes: 30, sleepiness: 4, fatigue: 0, clarity: 7, muscleFatigue: 14,
      caffeine: true, caffeineTime: "15:00", caffeineNote: "紅茶 1杯",
      headache: true, headacheIntensity: 4, headacheFeatures: ["aroundEyes", "other"], note: "",
      createdAt: "2026-09-09T00:00:00.000Z", updatedAt: "2026-09-09T00:00:00.000Z",
      weather: { pressureHpa: 998.4, temperatureC: 24.1, condition: "雨", weatherCode: 61, fetchedAt: "2026-09-09T03:00:00.000Z", source: "Open-Meteo" },
    }));

    expect(normalizeSleepRecord(stored)).toMatchObject({
      napMinutes: 30, caffeineTime: "15:00", caffeineNote: "紅茶 1杯", fatigue: 0, muscleFatigue: 10,
      headacheIntensity: 4, headacheFeatures: ["aroundEyes", "other"],
      weather: { pressureHpa: 998.4, temperatureC: 24.1, condition: "雨", weatherCode: 61, source: "Open-Meteo" },
    });
  });

  it("keeps an unselected headache intensity missing through storage and CSV, while preserving zero", () => {
    const missing = normalizeSleepRecord({
      id: "2026-09-10", date: "2026-09-10", bedTime: "23:30", wakeTime: "07:00",
      sleepMinutes: 450, napMinutes: 0, sleepiness: 4, clarity: 7,
      caffeine: false, headache: true, note: "", createdAt: "2026-09-10T00:00:00.000Z", updatedAt: "2026-09-10T00:00:00.000Z",
    });
    const zero = normalizeSleepRecord({
      id: "2026-09-11", date: "2026-09-11", bedTime: "23:30", wakeTime: "07:00",
      sleepMinutes: 450, napMinutes: 0, sleepiness: 4, clarity: 7,
      caffeine: false, headache: true, headacheIntensity: 0, note: "", createdAt: "2026-09-11T00:00:00.000Z", updatedAt: "2026-09-11T00:00:00.000Z",
    });

    expect(missing).not.toHaveProperty("headacheIntensity");
    expect(zero).toMatchObject({ headacheIntensity: 0 });
    const reloaded = recordsFromCsv(recordsToCsv([missing!, zero!]));
    expect(reloaded[0]).not.toHaveProperty("headacheIntensity");
    expect(reloaded[1]).toMatchObject({ headacheIntensity: 0 });
  });

});
