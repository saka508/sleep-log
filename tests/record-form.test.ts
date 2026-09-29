import { describe, expect, it } from "vitest";

import { clearRecordValidationError, hasValidActualSleepMinutes, parseNapDuration, validateRecordForm } from "../lib/record-form";

describe("record form optional values", () => {
  it("allows a new record to keep nap duration unrecorded", () => {
    expect(parseNapDuration("unknown", "")).toEqual({ valid: true, value: undefined });
  });

  it("distinguishes no nap from an unknown nap duration", () => {
    expect(parseNapDuration("no", "")).toEqual({ valid: true, value: 0 });
    expect(parseNapDuration("yes", "30")).toEqual({ valid: true, value: 30 });
  });

  it("rejects a selected nap without a positive duration", () => {
    expect(parseNapDuration("yes", "")).toEqual({ valid: false, value: undefined });
    expect(parseNapDuration("yes", "0")).toEqual({ valid: false, value: undefined });
    expect(parseNapDuration("yes", "invalid")).toEqual({ valid: false, value: undefined });
  });
});

describe("record form validation", () => {
  const validValues = {
    date: "2026-09-30",
    bedTime: "23:30",
    wakeTime: "07:00",
    sleepMinutes: "420",
    latencyMinutes: "",
    nap: "unknown" as const,
    napMinutes: "",
    caffeine: "no" as const,
    caffeineTime: "",
    timeInBedMinutes: 450,
  };

  it("returns a displayable validation error when actual sleep minutes are missing", () => {
    expect(validateRecordForm({ ...validValues, sleepMinutes: "" })).toMatchObject({
      code: "sleep-minutes",
      title: "実際に眠っていた時間を入力してください",
    });
  });

  it("accepts corrected actual sleep minutes without changing the save path", () => {
    expect(validateRecordForm(validValues)).toBeNull();
  });

  it("keeps other existing form errors distinguishable from actual sleep minutes", () => {
    expect(validateRecordForm({ ...validValues, sleepMinutes: "420", nap: "yes", napMinutes: "" })).toMatchObject({ code: "nap-minutes" });
    expect(validateRecordForm({ ...validValues, sleepMinutes: "420", caffeine: "yes", caffeineTime: "25:00" })).toMatchObject({ code: "caffeine-time" });
  });

  it("clears only the error addressed by a corrected input", () => {
    const error = validateRecordForm({ ...validValues, sleepMinutes: "" });
    expect(hasValidActualSleepMinutes("")).toBe(false);
    expect(hasValidActualSleepMinutes("0")).toBe(false);
    expect(hasValidActualSleepMinutes("420")).toBe(true);
    expect(clearRecordValidationError(error, "sleep-minutes")).toBeNull();
    expect(clearRecordValidationError(error, "nap-minutes")).toEqual(error);
  });
});
