import { isDateKey, isTime } from "./sleep-utils";

export type NapInputChoice = "unknown" | "no" | "yes";

export type ParsedNapDuration =
  | { valid: true; value: number | undefined }
  | { valid: false; value: undefined };

/**
 * Converts the three-state nap control into the optional stored value.
 * Unknown stays absent, while an explicit "no" is the observed value zero.
 */
export function parseNapDuration(
  choice: NapInputChoice,
  rawMinutes: string,
): ParsedNapDuration {
  if (choice === "unknown") return { valid: true, value: undefined };
  if (choice === "no") return { valid: true, value: 0 };
  const parsed = Number(rawMinutes);
  return Number.isFinite(parsed) && parsed > 0
    ? { valid: true, value: parsed }
    : { valid: false, value: undefined };
}

export type RecordValidationErrorCode =
  | "date"
  | "time"
  | "sleep-minutes"
  | "latency"
  | "nap-minutes"
  | "latency-over-time-in-bed"
  | "caffeine-time";

export type RecordValidationError = {
  code: RecordValidationErrorCode;
  title: string;
  message: string;
};

export type RecordFormValues = {
  date: string;
  bedTime: string;
  wakeTime: string;
  sleepMinutes: string;
  latencyMinutes: string;
  nap: NapInputChoice;
  napMinutes: string;
  caffeine: "yes" | "no";
  caffeineTime: string;
  timeInBedMinutes: number | null;
};

export function hasValidActualSleepMinutes(rawMinutes: string) {
  const minutes = Number(rawMinutes);
  return rawMinutes.trim() !== "" && Number.isFinite(minutes) && minutes > 0;
}

/**
 * Validates the raw values produced by the record form without coercing an
 * empty field to zero. Screens can render the returned message inline on web
 * where React Native's Alert is intentionally a no-op.
 */
export function validateRecordForm(values: RecordFormValues): RecordValidationError | null {
  if (!isDateKey(values.date)) {
    return { code: "date", title: "日付を確認してください", message: "YYYY-MM-DD の形式で入力してください。" };
  }
  if (!isTime(values.bedTime) || !isTime(values.wakeTime)) {
    return { code: "time", title: "時刻を確認してください", message: "就寝・起床時刻は HH:MM の24時間表記で入力してください。" };
  }

  if (!hasValidActualSleepMinutes(values.sleepMinutes)) {
    return {
      code: "sleep-minutes",
      title: "実際に眠っていた時間を入力してください",
      message: "実際に眠っていた時間を1分以上で入力してください。寝つくまでを入力した後は「再計算」も使えます。",
    };
  }

  const latency = values.latencyMinutes.trim() === "" ? undefined : Number(values.latencyMinutes);
  if (latency !== undefined && (!Number.isFinite(latency) || latency < 0)) {
    return { code: "latency", title: "寝つくまでの時間を確認してください", message: "寝つくまでの時間は、入力する場合0分以上にしてください。" };
  }

  if (!parseNapDuration(values.nap, values.napMinutes).valid) {
    return { code: "nap-minutes", title: "昼寝時間を確認してください", message: "昼寝ありの場合は、昼寝時間を1分以上で入力してください。" };
  }

  if (values.timeInBedMinutes !== null && latency !== undefined && latency > values.timeInBedMinutes) {
    return { code: "latency-over-time-in-bed", title: "寝つくまでの時間を確認してください", message: "寝つくまでの時間は、就寝から起床までの時間を超えない値にしてください。" };
  }

  if (values.caffeine === "yes" && values.caffeineTime.trim() && !isTime(values.caffeineTime)) {
    return { code: "caffeine-time", title: "摂取時刻を確認してください", message: "HH:MM の24時間表記で入力するか、空欄にしてください。" };
  }

  return null;
}

/** Clears only an error addressed by the field the user just changed. */
export function clearRecordValidationError(
  error: RecordValidationError | null,
  ...codes: RecordValidationErrorCode[]
) {
  return error && codes.includes(error.code) ? null : error;
}
