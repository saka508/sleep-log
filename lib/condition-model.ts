import { sortRecords, type HeadacheFeature, type SleepRecord } from "./sleep-utils";

/**
 * Origin of a domain value. Keep this deliberately small until an actual
 * Health/wearable adapter needs more metadata.
 */
export type DataSource = "manual" | "wearable" | "health";

export type SleepCondition = {
  source: DataSource;
  bedTime: string;
  wakeTime: string;
  sleepMinutes: number;
  latencyMinutes?: number;
  napMinutes?: number;
};

export type ExerciseSet = {
  repetitions?: number;
  durationMinutes?: number;
  distanceMeters?: number;
  rpe?: number;
  restSeconds?: number;
};

export type ExerciseSession = {
  id: string;
  activity: string;
  source: DataSource;
  sets?: ExerciseSet[];
  durationMinutes?: number;
  distanceMeters?: number;
  laps?: number[];
};

export type ExerciseCondition = {
  source: DataSource;
  sessions: ExerciseSession[];
};

export type NutritionCondition = {
  source: DataSource;
  proteinGrams?: number;
  waterMilliliters?: number;
  meals?: string[];
  caffeineConsumed?: boolean;
  caffeineTime?: string;
  caffeineNote?: string;
};

export type EnvironmentCondition = {
  source: DataSource;
  pressureHpa?: number;
  weather?: string;
  temperatureCelsius?: number;
  humidityPercent?: number;
};

export type SubjectiveCondition = {
  source: DataSource;
  sleepiness?: number;
  fatigue?: number;
  clarity?: number;
  headache?: boolean;
  headacheIntensity?: number;
  headacheFeatures?: HeadacheFeature[];
  muscleFatigue?: number;
};

/**
 * Canonical read model for one local calendar day. Every domain is optional so
 * incomplete daily entries and future automatically collected data are valid.
 */
export type DailyConditionRecord = {
  date: string;
  sleep?: SleepCondition;
  exercise?: ExerciseCondition;
  nutrition?: NutritionCondition;
  environment?: EnvironmentCondition;
  subjective?: SubjectiveCondition;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Compatibility adapter for the original flat SleepRecord. It does not mutate
 * or migrate stored data; the existing AsyncStorage and CSV formats stay intact.
 */
export function dailyConditionFromSleepRecord(record: SleepRecord): DailyConditionRecord {
  return {
    date: record.date,
    sleep: {
      source: "manual",
      bedTime: record.bedTime,
      wakeTime: record.wakeTime,
      sleepMinutes: record.sleepMinutes,
      latencyMinutes: record.latencyMinutes,
      napMinutes: record.napMinutes,
    },
    nutrition: {
      source: "manual",
      caffeineConsumed: record.caffeine,
      caffeineTime: record.caffeineTime,
      caffeineNote: record.caffeineNote,
    },
    subjective: {
      source: "manual",
      sleepiness: record.sleepiness,
      clarity: record.clarity,
      headache: record.headache,
      headacheIntensity: record.headacheIntensity,
      headacheFeatures: record.headacheFeatures,
    },
    note: record.note || undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function dailyConditionsFromSleepRecords(records: SleepRecord[]): DailyConditionRecord[] {
  return sortRecords(records).map(dailyConditionFromSleepRecord);
}
