import { describe, expect, it } from "vitest";

import { recordsFromCsv, recordsToCsv } from "../lib/csv-core";
import {
  clockValueForChart,
  correlation,
  createSampleRecords,
  daysFromToday,
  formatDuration,
  normalizeSleepRecord,
  sleepMinutesFromTimes,
  timeToMinutes,
  todayKey,
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
      clarity: 7,
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
  });

  it("imports a Phase 1 CSV with all original columns and safe defaults", () => {
    const legacyCsv = "日付,就寝時刻,起床時刻,実睡眠時間（分）,寝つくまで（分）,昼寝時間（分）,眠気（0-10）,頭の冴え（0-10）,カフェイン,頭痛,メモ\n2026-09-08,23:45,07:10,425,15,0,3,8,なし,なし,旧形式";

    expect(recordsFromCsv(legacyCsv)[0]).toMatchObject({
      date: "2026-09-08",
      caffeineTime: "",
      caffeineNote: "",
      headacheIntensity: 0,
      headacheFeatures: [],
      note: "旧形式",
    });
  });
});

describe("stored record compatibility", () => {
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
  });

  it("preserves valid detailed fields through JSON storage", () => {
    const stored = JSON.parse(JSON.stringify({
      id: "2026-09-09", date: "2026-09-09", bedTime: "23:30", wakeTime: "07:00",
      sleepMinutes: 450, latencyMinutes: 20, napMinutes: 30, sleepiness: 4, clarity: 7,
      caffeine: true, caffeineTime: "15:00", caffeineNote: "紅茶 1杯",
      headache: true, headacheIntensity: 4, headacheFeatures: ["aroundEyes", "other"], note: "",
      createdAt: "2026-09-09T00:00:00.000Z", updatedAt: "2026-09-09T00:00:00.000Z",
      weather: { pressureHpa: 998.4, temperatureC: 24.1, condition: "雨", weatherCode: 61, fetchedAt: "2026-09-09T03:00:00.000Z", source: "Open-Meteo" },
    }));

    expect(normalizeSleepRecord(stored)).toMatchObject({
      napMinutes: 30, caffeineTime: "15:00", caffeineNote: "紅茶 1杯",
      headacheIntensity: 4, headacheFeatures: ["aroundEyes", "other"],
      weather: { pressureHpa: 998.4, temperatureC: 24.1, condition: "雨", weatherCode: 61, source: "Open-Meteo" },
    });
  });
});
