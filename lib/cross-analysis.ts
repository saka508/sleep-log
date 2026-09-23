import {
  getAnalysisMetricValue,
  median,
  recordsForPersonalAnalysis,
  type AnalysisMetric,
} from "./condition-analysis";
import { isDateKey, type SleepRecord } from "./sleep-utils";

export type SleepMinutesOperator = "lt" | "lte" | "gt" | "gte" | "eq" | "between";

export type SleepMinutesCondition = {
  id: string;
  field: "sleepMinutes";
  operator: SleepMinutesOperator;
  value: number;
  upperValue?: number;
};

export type CrossAnalysisOutcome = "sleepiness" | "fatigue" | "clarity" | "dailyHeadache";

/**
 * sameRecord follows the app's current model: sleep and subjective values in
 * one SleepRecord belong together. nextLocalDate is represented so callers
 * can receive an explicit unsupported result until record.date semantics are
 * confirmed; the engine does not guess by adding a calendar day.
 */
export type RecordAlignment = "sameRecord" | "nextLocalDate";

export type CrossAnalysisQuery = {
  period: { startDate: string; endDate: string };
  conditions: SleepMinutesCondition[];
  conditionMatch: "all";
  outcome: CrossAnalysisOutcome;
  alignment: RecordAlignment;
};

export type CrossAnalysisExclusions = {
  sampleRecords: number;
  outsidePeriod: number;
  invalidDate: number;
  invalidSleepMinutes: number;
  unmatchedOutcomeDate: number;
  missingOutcome: number;
};

export type CrossAnalysisObservation = {
  conditionDate: string;
  outcomeDate: string;
  sleepMinutes: number;
  outcomeValue: number;
};

export type CrossAnalysisGroup = {
  count: number;
  average: number | null;
  median: number | null;
  conditionDates: string[];
  outcomeDates: string[];
  observations: CrossAnalysisObservation[];
};

export type CrossAnalysisStatus =
  | "ready"
  | "invalidQuery"
  | "unsupportedAlignment"
  | "noEligibleRecords"
  | "noMatchedRecords"
  | "noComparisonRecords";

export type CrossAnalysisResult = {
  schemaVersion: 1;
  status: CrossAnalysisStatus;
  reason: string | null;
  query: CrossAnalysisQuery;
  comparisonDefinition: "matched-valid-records-vs-unmatched-valid-records-in-period";
  alignmentEvidence: {
    rule: RecordAlignment;
    description: string;
    recordDateMeaningConfirmed: boolean;
  };
  groups: {
    matched: CrossAnalysisGroup;
    comparison: CrossAnalysisGroup;
  };
  averageDifference: number | null;
  exclusions: CrossAnalysisExclusions;
  evidence: {
    sourceRecordCount: number;
    personalRecordCount: number;
    eligibleRecordCount: number;
    usedConditionDates: string[];
    minimumGroupSize: null;
    inference: "not-assessed";
    limitations: string[];
  };
};

const outcomeMetric: Record<CrossAnalysisOutcome, AnalysisMetric> = {
  sleepiness: "sleepiness",
  fatigue: "fatigue",
  clarity: "clarity",
  dailyHeadache: "headacheIntensity",
};

function validCondition(condition: SleepMinutesCondition) {
  if (!condition.id.trim() || !Number.isFinite(condition.value) || condition.value < 0) return false;
  if (condition.operator !== "between") return true;
  return Number.isFinite(condition.upperValue) && condition.upperValue! >= condition.value;
}

function matchesCondition(sleepMinutes: number, condition: SleepMinutesCondition) {
  switch (condition.operator) {
    case "lt": return sleepMinutes < condition.value;
    case "lte": return sleepMinutes <= condition.value;
    case "gt": return sleepMinutes > condition.value;
    case "gte": return sleepMinutes >= condition.value;
    case "eq": return sleepMinutes === condition.value;
    case "between": return sleepMinutes >= condition.value && sleepMinutes <= condition.upperValue!;
  }
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildGroup(observations: CrossAnalysisObservation[]): CrossAnalysisGroup {
  const ordered = [...observations].sort((a, b) =>
    a.conditionDate.localeCompare(b.conditionDate) || a.outcomeDate.localeCompare(b.outcomeDate),
  );
  const values = ordered.map((observation) => observation.outcomeValue);
  return {
    count: ordered.length,
    average: values.length ? mean(values) : null,
    median: median(values),
    conditionDates: ordered.map((observation) => observation.conditionDate),
    outcomeDates: ordered.map((observation) => observation.outcomeDate),
    observations: ordered,
  };
}

function emptyExclusions(): CrossAnalysisExclusions {
  return {
    sampleRecords: 0,
    outsidePeriod: 0,
    invalidDate: 0,
    invalidSleepMinutes: 0,
    unmatchedOutcomeDate: 0,
    missingOutcome: 0,
  };
}

function alignmentEvidence(alignment: RecordAlignment): CrossAnalysisResult["alignmentEvidence"] {
  if (alignment === "sameRecord") {
    return {
      rule: alignment,
      description: "睡眠と状態を同じSleepRecord内で対応させる",
      recordDateMeaningConfirmed: true,
    };
  }
  return {
    rule: alignment,
    description: "睡眠記録日の翌ローカル日付を使う案だが、日付の意味が未確定のため実行しない",
    recordDateMeaningConfirmed: false,
  };
}

function resultWithStatus(
  query: CrossAnalysisQuery,
  status: CrossAnalysisStatus,
  reason: string,
  records: SleepRecord[],
  exclusions = emptyExclusions(),
): CrossAnalysisResult {
  const matched = buildGroup([]);
  const comparison = buildGroup([]);
  return {
    schemaVersion: 1,
    status,
    reason,
    query,
    comparisonDefinition: "matched-valid-records-vs-unmatched-valid-records-in-period",
    alignmentEvidence: alignmentEvidence(query.alignment),
    groups: { matched, comparison },
    averageDifference: null,
    exclusions,
    evidence: {
      sourceRecordCount: records.length,
      personalRecordCount: recordsForPersonalAnalysis(records).length,
      eligibleRecordCount: 0,
      usedConditionDates: [],
      minimumGroupSize: null,
      inference: "not-assessed",
      limitations: [
        "最低件数と傾向判定の基準は未決定のため、統計的推論は行わない",
        "関連や群間差は因果関係、診断、予測を示さない",
      ],
    },
  };
}

/**
 * Recomputes a descriptive two-group comparison from the supplied records.
 * It has no persistence, cache, clock, network, or UI side effects.
 */
export function analyzeSleepConditionComparison(
  records: SleepRecord[],
  query: CrossAnalysisQuery,
): CrossAnalysisResult {
  if (
    !isDateKey(query.period.startDate)
    || !isDateKey(query.period.endDate)
    || query.period.startDate > query.period.endDate
    || !query.conditions.length
    || query.conditions.some((condition) => !validCondition(condition))
  ) {
    return resultWithStatus(query, "invalidQuery", "期間または条件が不正です。", records);
  }
  if (query.alignment === "nextLocalDate") {
    return resultWithStatus(
      query,
      "unsupportedAlignment",
      "SleepRecord.dateが就寝日と起床日のどちらを表すか未確定のため、翌日対応は実行できません。",
      records,
    );
  }

  const exclusions = emptyExclusions();
  exclusions.sampleRecords = records.filter((record) => record.isSample).length;
  const personalRecords = recordsForPersonalAnalysis(records)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const byDate = new Map(personalRecords.filter((record) => isDateKey(record.date)).map((record) => [record.date, record]));
  const matched: CrossAnalysisObservation[] = [];
  const comparison: CrossAnalysisObservation[] = [];

  for (const record of personalRecords) {
    if (!isDateKey(record.date)) {
      exclusions.invalidDate += 1;
      continue;
    }
    if (record.date < query.period.startDate || record.date > query.period.endDate) {
      exclusions.outsidePeriod += 1;
      continue;
    }
    if (!Number.isFinite(record.sleepMinutes) || record.sleepMinutes <= 0) {
      exclusions.invalidSleepMinutes += 1;
      continue;
    }
    const outcomeDate = record.date;
    const outcomeRecord = byDate.get(outcomeDate);
    if (!outcomeRecord) {
      exclusions.unmatchedOutcomeDate += 1;
      continue;
    }
    const value = getAnalysisMetricValue(outcomeRecord, outcomeMetric[query.outcome]);
    if (value === null || !Number.isFinite(value)) {
      exclusions.missingOutcome += 1;
      continue;
    }
    const observation: CrossAnalysisObservation = {
      conditionDate: record.date,
      outcomeDate,
      sleepMinutes: record.sleepMinutes,
      outcomeValue: value,
    };
    const target = query.conditions.every((condition) => matchesCondition(record.sleepMinutes, condition))
      ? matched
      : comparison;
    target.push(observation);
  }

  const matchedGroup = buildGroup(matched);
  const comparisonGroup = buildGroup(comparison);
  const eligibleRecordCount = matchedGroup.count + comparisonGroup.count;
  const status: CrossAnalysisStatus = eligibleRecordCount === 0
    ? "noEligibleRecords"
    : matchedGroup.count === 0
      ? "noMatchedRecords"
      : comparisonGroup.count === 0
        ? "noComparisonRecords"
        : "ready";
  const reason = status === "noEligibleRecords"
    ? "条件と結果項目を比較できる記録がありません。"
    : status === "noMatchedRecords"
      ? "条件を満たす有効記録がありません。"
      : status === "noComparisonRecords"
        ? "条件を満たさない比較対象の有効記録がありません。"
        : null;

  return {
    schemaVersion: 1,
    status,
    reason,
    query,
    comparisonDefinition: "matched-valid-records-vs-unmatched-valid-records-in-period",
    alignmentEvidence: alignmentEvidence(query.alignment),
    groups: { matched: matchedGroup, comparison: comparisonGroup },
    averageDifference: matchedGroup.average !== null && comparisonGroup.average !== null
      ? matchedGroup.average - comparisonGroup.average
      : null,
    exclusions,
    evidence: {
      sourceRecordCount: records.length,
      personalRecordCount: personalRecords.length,
      eligibleRecordCount,
      usedConditionDates: [...matchedGroup.conditionDates, ...comparisonGroup.conditionDates].sort(),
      minimumGroupSize: null,
      inference: "not-assessed",
      limitations: [
        "最低件数と傾向判定の基準は未決定のため、統計的推論は行わない",
        "関連や群間差は因果関係、診断、予測を示さない",
      ],
    },
  };
}
