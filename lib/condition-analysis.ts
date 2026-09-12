import { clockValueForChart, correlation, dateFromKey, formatClockValue, formatDuration, formatShortDate, timeToMinutes, type SleepRecord } from "./sleep-utils";

export type AnalysisGranularity = "day" | "week" | "month";

export type AnalysisMetric =
  | "sleepMinutes"
  | "bedTime"
  | "wakeTime"
  | "napMinutes"
  | "sleepiness"
  | "fatigue"
  | "clarity"
  | "headacheIntensity"
  | "muscleFatigue"
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

export type AnalysisQualityStatus = "empty" | "insufficient" | "reference" | "partial" | "sufficient";

export type AnalysisQuality = {
  periodLabel: string;
  totalRecords: number;
  personalRecords: number;
  excludedSampleRecords: number;
  validMetricRecords: number;
  missingMetricRecords: number;
  periodGroups: number;
  validPeriodGroups: number;
  metricLabel: string;
  minimumRelationPairs: number;
  relationPairs: Pick<RelationResult, "key" | "label" | "pairedCount" | "status">[];
  status: AnalysisQualityStatus;
  statusLabel: string;
  message: string;
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
  fatigue: "疲労",
  clarity: "頭の冴え",
  headacheIntensity: "頭痛の強さ",
  muscleFatigue: "筋肉疲労",
  pressureHpa: "気圧",
};

export function getAnalysisMetricLabel(metric: AnalysisMetric) {
  return metricLabels[metric];
}

/**
 * Sample records make the first launch easier to understand, but must never
 * influence a person's trend, correlation, or reference values.
 */
export function recordsForPersonalAnalysis(records: SleepRecord[]) {
  return records.filter((record) => !record.isSample);
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
    default: {
      const value = record[metric];
      return Number.isFinite(value) ? value ?? null : null;
    }
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
  recordsForPersonalAnalysis(records).slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((record) => {
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

function granularityLabel(granularity: AnalysisGranularity) {
  return granularity === "day" ? "日別" : granularity === "week" ? "週別" : "月別";
}

function periodLabel(records: SleepRecord[], granularity: AnalysisGranularity) {
  if (!records.length) return `${granularityLabel(granularity)}・個人記録なし`;
  const dates = records.map((record) => record.date).sort();
  const start = dates[0].replaceAll("-", "/");
  const end = dates.at(-1)?.replaceAll("-", "/") ?? start;
  return `${granularityLabel(granularity)}・${start}${start === end ? "" : `〜${end}`}`;
}

/**
 * Builds display-only metadata for the current personal analysis. It does not
 * persist results and deliberately reuses the same sample exclusion and
 * missing-value rules as trends and relations.
 */
export function assessAnalysisQuality(
  records: SleepRecord[],
  metric: AnalysisMetric,
  granularity: AnalysisGranularity,
  relations: RelationResult[],
): AnalysisQuality {
  const personalRecords = recordsForPersonalAnalysis(records);
  const trend = buildTrend(records, metric, granularity);
  const validMetricRecords = personalRecords.filter((record) => getAnalysisMetricValue(record, metric) !== null).length;
  const missingMetricRecords = personalRecords.length - validMetricRecords;
  const base = {
    periodLabel: periodLabel(personalRecords, granularity),
    totalRecords: records.length,
    personalRecords: personalRecords.length,
    excludedSampleRecords: records.length - personalRecords.length,
    validMetricRecords,
    missingMetricRecords,
    periodGroups: trend.length,
    validPeriodGroups: trend.filter((point) => point.value !== null).length,
    metricLabel: getAnalysisMetricLabel(metric),
    minimumRelationPairs: MIN_RELATION_RECORDS,
    relationPairs: relations.map(({ key, label, pairedCount, status }) => ({ key, label, pairedCount, status })),
  };
  if (!personalRecords.length) return { ...base, status: "empty", statusLabel: "データなし", message: "個人分析に使用できる記録はありません。" };
  if (!validMetricRecords) return { ...base, status: "insufficient", statusLabel: "データ不足", message: `「${base.metricLabel}」の有効データがないため、参考値は表示していません。` };
  if (validMetricRecords < MIN_RELATION_RECORDS) return { ...base, status: "reference", statusLabel: "参考表示", message: `「${base.metricLabel}」は ${validMetricRecords} 件です。相関の最低 ${MIN_RELATION_RECORDS} 組には届かないため、参考表示です。` };
  if (missingMetricRecords) return { ...base, status: "partial", statusLabel: "一部欠損", message: `「${base.metricLabel}」は欠損 ${missingMetricRecords} 件を除外しています。解釈には注意してください。` };
  return { ...base, status: "sufficient", statusLabel: "十分なデータ", message: `「${base.metricLabel}」は ${validMetricRecords} 件の個人記録を使っています。` };
}

function relationResult(key: RelationKey, label: string, xLabel: string, yLabel: string, pairs: { x: number; y: number }[]): RelationResult {
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
  const ordered = recordsForPersonalAnalysis(records).slice().sort((a, b) => a.date.localeCompare(b.date));
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
  const qualifying = recordsForPersonalAnalysis(records).filter((record) => record.sleepiness <= 3 && record.clarity >= 7);
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
