import { dateFromKey, dateKey, formatDuration, type SleepRecord } from "./sleep-utils";

export const HOME_BASELINE_LOOKBACK_DAYS = 30;
export const HOME_BASELINE_MIN_RECORDS = 3;

export type HomeComparisonRow = {
  key: "sleep" | "fatigue" | "exercise" | "recovery";
  label: string;
  usual: string;
  today: string;
  validDays: number;
  supported: boolean;
};

export type HomeComparison = {
  rows: HomeComparisonRow[];
  baselineStart: string;
  baselineEnd: string;
  lookbackDays: number;
  minimumRecords: number;
};

function localDayOffset(key: string, offset: number) {
  const date = dateFromKey(key);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return dateKey(date);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function usualValue(values: number[], format: (value: number) => string, minimumRecords: number) {
  const value = median(values);
  return values.length >= minimumRecords && value !== null ? format(value) : "データ不足";
}

/**
 * Builds the compact home comparison without persisting derived data.
 * The personal baseline uses medians from the previous local-calendar days,
 * excludes today and sample records, and ignores missing metric values.
 */
export function buildHomeComparison(
  records: SleepRecord[],
  today: string,
  options: { lookbackDays?: number; minimumRecords?: number } = {},
): HomeComparison {
  const lookbackDays = options.lookbackDays ?? HOME_BASELINE_LOOKBACK_DAYS;
  const minimumRecords = options.minimumRecords ?? HOME_BASELINE_MIN_RECORDS;
  const baselineStart = localDayOffset(today, -lookbackDays);
  const baselineEnd = localDayOffset(today, -1);
  const personal = records.filter((record) => !record.isSample);
  const baseline = personal.filter((record) => record.date >= baselineStart && record.date <= baselineEnd);
  const todayRecord = personal.find((record) => record.date === today);
  const sleepValues = baseline
    .map((record) => record.sleepMinutes)
    .filter((value) => Number.isFinite(value) && value > 0);
  const fatigueValues = baseline
    .map((record) => record.fatigue)
    .filter((value): value is number => value !== undefined && Number.isFinite(value));

  return {
    baselineStart,
    baselineEnd,
    lookbackDays,
    minimumRecords,
    rows: [
      {
        key: "sleep",
        label: "睡眠",
        usual: usualValue(sleepValues, (value) => formatDuration(value, true), minimumRecords),
        today: todayRecord && todayRecord.sleepMinutes > 0 ? formatDuration(todayRecord.sleepMinutes, true) : "記録なし",
        validDays: sleepValues.length,
        supported: true,
      },
      {
        key: "fatigue",
        label: "疲労",
        usual: usualValue(fatigueValues, (value) => `${value.toFixed(1)} / 10`, minimumRecords),
        today: todayRecord?.fatigue !== undefined ? `${todayRecord.fatigue} / 10` : "未記録",
        validDays: fatigueValues.length,
        supported: true,
      },
      {
        key: "exercise",
        label: "運動",
        usual: "未対応",
        today: "未対応",
        validDays: 0,
        supported: false,
      },
      {
        key: "recovery",
        label: "回復",
        usual: "未対応",
        today: "未対応",
        validDays: 0,
        supported: false,
      },
    ],
  };
}
