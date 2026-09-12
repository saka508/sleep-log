import { clockValueForChart, correlation, dateFromKey, formatClockValue, formatDuration, formatShortDate, timeToMinutes, type SleepRecord } from "./sleep-utils";

export type AnalysisGranularity = "day" | "week" | "month";

export type AnalysisMetric =
  | "sleepMinutes"
  | "bedTime"
  | "wakeTime"
  | "napMinutes"
  | "sleepiness"
  | "clarity"
  | "headacheIntensity"
  | "pressureHpa";

export type TrendPoint = {
  key: string;
  label: string;
  recordDays: number;
  value: number | null;
};

export type MetricSummary = {
  average: number | null;
  median: number | null;
  dataDays: number;
};

export type RelationKey =
  | "sleepSleepiness"
  | "sleepClarity"
  | "napSleep"
  | "pressureHeadache"
  | "pressureChangeHeadache"
  | "caffeineTimeSleep"
  | "caffeineTimeSleepiness";

export type RelationResult = {
  key: RelationKey;
  label: string;
  xLabel: string;
  yLabel: string;
  pairedCount: number;
  coefficient: number | null;
  status: "ready" | "insufficient" | "constant";
};

export const MIN_RELATION_RECORDS = 5;
export const MIN_RECOMMENDATION_RECORDS = 7;
// This is a display safeguard, not a medical target. A shorter historical
// median is deliberately not surfaced as a recommendation.
export const MIN_RECOMMENDATION_SLEEP_MINUTES = 7 * 60;

export type SleepRecommendation =
  | { status: "insufficient"; qualifyingDays: number; minimumDays: number }
  | { status: "tooShort"; qualifyingDays: number; targetSleepMinutes: number }
  | {
      status: "ready";
      qualifyingDays: number;
      targetSleepMinutes: number;
      bedTime: string;
      wakeTime: string;
      criteria: string;
    };

const metricLabels: Record<AnalysisMetric, string> = {
  sleepMinutes: "睡眠時間",
  bedTime: "就寝時刻",
  wakeTime: "起床時刻",
  napMinutes: "昼寝時間",
  sleepiness: "眠気",
  clarity: "頭の冴え",
  headacheIntensity: "頭痛の強さ",
  pressureHpa: "気圧",
};

export function getAnalysisMetricLabel(metric: AnalysisMetric) {
  return metricLabels[metric];
}

export function getAnalysisMetricValue(record: SleepRecord, metric: AnalysisMetric): number | null {
  switch (metric) {
    case "bedTime":
      return clockValueForChart(record.bedTime, true);
    case "wakeTime":
      return clockValueForChart(record.wakeTime);
    case "headacheIntensity":
      // A recorded "なし" is a meaningful zero; an "あり" without a selected
      // strength remains missing instead of being fabricated as zero.
      return record.headache ? (Number.isFinite(record.headacheIntensity) ? record.headacheIntensity ?? null : null) : 0;
    case "pressureHpa":
      return Number.isFinite(record.weather?.pressureHpa) ? record.weather?.pressureHpa ?? null : null;
    default:
      return Number.isFinite(record[metric]) ? record[metric] : null;
  }
}

export function formatAnalysisMetric(metric: AnalysisMetric, value: number | null) {
  if (value === null || !Number.isFinite(value)) return "データなし";
  if (metric === "sleepMinutes" || metric === "napMinutes") return formatDuration(value, true);
  if (metric === "bedTime" || metric === "wakeTime") return formatClockValue(value);
  if (metric === "pressureHpa") return `${value.toFixed(1)} hPa`;
  return `${value.toFixed(1)} / 10`;
}

function mean(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function weekStartKey(date: string) {
  const local = dateFromKey(date);
  local.setHours(12, 0, 0, 0);
  local.setDate(local.getDate() - ((local.getDay() + 6) % 7));
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

function groupFor(date: string, granularity: AnalysisGranularity) {
  if (granularity === "day") return { key: date, label: formatShortDate(date) };
  if (granularity === "week") {
    const key = weekStartKey(date);
    return { key, label: `${formatShortDate(key)}週` };
  }
  return { key: date.slice(0, 7), label: `${date.slice(0, 4)}/${date.slice(5, 7)}` };
}

/** Aggregates only valid values; empty groups stay null and are never coerced to zero. */
export function buildTrend(records: SleepRecord[], metric: AnalysisMetric, granularity: AnalysisGranularity): TrendPoint[] {
  const groups = new Map<string, { label: string; recordDays: number; values: number[] }>();
  records.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((record) => {
    const group = groupFor(record.date, granularity);
    const current = groups.get(group.key) ?? { label: group.label, recordDays: 0, values: [] };
    current.recordDays += 1;
    const value = getAnalysisMetricValue(record, metric);
    if (value !== null && Number.isFinite(value)) current.values.push(value);
    groups.set(group.key, current);
  });
  return [...groups.entries()].map(([key, group]) => ({
    key,
    label: group.label,
    recordDays: group.recordDays,
    value: group.values.length ? mean(group.values) : null,
  }));
}

export function summarizeTrend(points: TrendPoint[]): MetricSummary {
  const values = points.flatMap((point) => point.value === null ? [] : [point.value]);
  return { average: values.length ? mean(values) : null, median: median(values), dataDays: values.length };
}

function relationResult(key: RelationKey, label: string, xLabel: string, yLabel: string, pairs: Array<{ x: number; y: number }>): RelationResult {
  if (pairs.length < MIN_RELATION_RECORDS) return { key, label, xLabel, yLabel, pairedCount: pairs.length, coefficient: null, status: "insufficient" };
  const coefficient = correlation(pairs);
  return { key, label, xLabel, yLabel, pairedCount: pairs.length, coefficient, status: coefficient === null ? "constant" : "ready" };
}

function pairedMetric(records: SleepRecord[], x: AnalysisMetric, y: AnalysisMetric) {
  return records.flatMap((record) => {
    const xValue = getAnalysisMetricValue(record, x);
    const yValue = getAnalysisMetricValue(record, y);
    return xValue === null || yValue === null ? [] : [{ x: xValue, y: yValue }];
  });
}

function consecutiveDay(previous: string, current: string) {
  const before = dateFromKey(previous);
  const after = dateFromKey(current);
  before.setHours(12, 0, 0, 0);
  after.setHours(12, 0, 0, 0);
  return (after.getTime() - before.getTime()) / 86_400_000 === 1;
}

export function analyzeRelation(records: SleepRecord[], key: RelationKey): RelationResult {
  const ordered = records.slice().sort((a, b) => a.date.localeCompare(b.date));
  switch (key) {
    case "sleepSleepiness":
      return relationResult(key, "睡眠時間と眠気", "睡眠時間", "眠気", pairedMetric(ordered, "sleepMinutes", "sleepiness"));
    case "sleepClarity":
      return relationResult(key, "睡眠時間と頭の冴え", "睡眠時間", "頭の冴え", pairedMetric(ordered, "sleepMinutes", "clarity"));
    case "napSleep":
      return relationResult(key, "昼寝と夜の睡眠", "昼寝時間", "夜の睡眠時間", pairedMetric(ordered, "napMinutes", "sleepMinutes"));
    case "pressureHeadache":
      return relationResult(key, "気圧と頭痛", "気圧", "頭痛の強さ", pairedMetric(ordered, "pressureHpa", "headacheIntensity"));
    case "pressureChangeHeadache": {
      const pairs = ordered.flatMap((record, index) => {
        const previous = ordered[index - 1];
        const pressure = getAnalysisMetricValue(record, "pressureHpa");
        const previousPressure = previous ? getAnalysisMetricValue(previous, "pressureHpa") : null;
        const headache = getAnalysisMetricValue(record, "headacheIntensity");
        return previous && consecutiveDay(previous.date, record.date) && pressure !== null && previousPressure !== null && headache !== null
          ? [{ x: pressure - previousPressure, y: headache }]
          : [];
      });
      return relationResult(key, "気圧変化と頭痛", "前日からの気圧変化", "頭痛の強さ", pairs);
    }
    case "caffeineTimeSleep":
    case "caffeineTimeSleepiness": {
      const yMetric: AnalysisMetric = key === "caffeineTimeSleep" ? "sleepMinutes" : "sleepiness";
      const pairs = ordered.flatMap((record) => {
        const time = record.caffeine && record.caffeineTime ? timeToMinutes(record.caffeineTime) : null;
        const y = getAnalysisMetricValue(record, yMetric);
        return time === null || y === null ? [] : [{ x: time, y }];
      });
      return relationResult(key, key === "caffeineTimeSleep" ? "カフェイン時刻と睡眠" : "カフェイン時刻と眠気", "カフェイン摂取時刻", yMetric === "sleepMinutes" ? "睡眠時間" : "眠気", pairs);
    }
  }
}

export function buildSleepRecommendation(records: SleepRecord[]): SleepRecommendation {
  const qualifying = records.filter((record) => !record.isSample && record.sleepiness <= 3 && record.clarity >= 7);
  if (qualifying.length < MIN_RECOMMENDATION_RECORDS) {
    return { status: "insufficient", qualifyingDays: qualifying.length, minimumDays: MIN_RECOMMENDATION_RECORDS };
  }
  const targetSleepMinutes = Math.round(median(qualifying.map((record) => record.sleepMinutes)) ?? 0);
  if (targetSleepMinutes < MIN_RECOMMENDATION_SLEEP_MINUTES) {
    return { status: "tooShort", qualifyingDays: qualifying.length, targetSleepMinutes };
  }
  const bed = median(qualifying.map((record) => clockValueForChart(record.bedTime, true))) ?? 0;
  const wake = median(qualifying.map((record) => clockValueForChart(record.wakeTime))) ?? 0;
  return {
    status: "ready",
    qualifyingDays: qualifying.length,
    targetSleepMinutes,
    bedTime: formatClockValue(bed),
    wakeTime: formatClockValue(wake),
    criteria: `眠気が 3 / 10 以下、頭の冴えが 7 / 10 以上だった ${qualifying.length} 日`,
  };
}
