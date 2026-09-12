import { describe, expect, it } from "vitest";

import {
  createHeadacheEventId,
  headacheEventsFromBackupJson,
  headacheEventsToBackupJson,
  localDateTimeToIso,
  mergeHeadacheEvents,
  normalizeHeadacheEvent,
  normalizeHeadacheEventStore,
  type HeadacheEvent,
} from "../lib/headache-events";

function event(id: string, overrides: Partial<HeadacheEvent> = {}): HeadacheEvent {
  return {
    schemaVersion: 1,
    id,
    date: "2026-09-13",
    startedAt: "2026-09-13T01:00:00.000Z",
    severity: 4,
    symptoms: ["oneSide"],
    source: "manual",
    createdAt: "2026-09-13T01:01:00.000Z",
    updatedAt: "2026-09-13T01:01:00.000Z",
    ...overrides,
  };
}

describe("headache events", () => {
  it("keeps multiple events from the same date with stable ids", () => {
    const first = event("first");
    const second = event("second", { startedAt: "2026-09-13T08:00:00.000Z" });
    expect(normalizeHeadacheEventStore({ schemaVersion: 1, events: [first, second] }).events.map((item) => item.id)).toEqual(["second", "first"]);
    expect(mergeHeadacheEvents([first], [{ ...first, severity: 7, updatedAt: "2026-09-13T02:00:00.000Z" }])).toEqual([expect.objectContaining({ id: "first", severity: 7 })]);
  });

  it("distinguishes zero, missing severity, observation time, and fetch time", () => {
    const zero = normalizeHeadacheEvent(event("zero", { severity: 0 }));
    const missing = normalizeHeadacheEvent(event("missing", { severity: null }));
    expect(zero?.severity).toBe(0);
    expect(missing?.severity).toBeNull();
    const withWeather = normalizeHeadacheEvent(event("weather", { weatherSnapshot: {
      pressureHpa: 1001.24, temperatureC: 22.36, condition: "曇り", weatherCode: 3,
      observedAt: "2026-09-13T01:00:00.000Z", fetchedAt: "2026-09-13T01:07:00.000Z", source: "Open-Meteo",
    } }));
    expect(withWeather?.weatherSnapshot).toMatchObject({ pressureHpa: 1001.2, temperatureC: 22.4, observedAt: "2026-09-13T01:00:00.000Z", fetchedAt: "2026-09-13T01:07:00.000Z" });
  });

  it("clamps out-of-range severity and drops invalid symptoms and weather", () => {
    const normalized = normalizeHeadacheEvent(event("invalid", {
      severity: 20,
      symptoms: ["nausea", "invalid" as never],
      weatherSnapshot: { pressureHpa: Number.NaN, temperatureC: 20, condition: "晴れ", weatherCode: 0, observedAt: "bad", fetchedAt: "bad", source: "Open-Meteo" },
    }));
    expect(normalized).toMatchObject({ severity: 10, symptoms: ["nausea"] });
    expect(normalized).not.toHaveProperty("weatherSnapshot");
  });

  it("drops one broken event without losing valid events", () => {
    const store = normalizeHeadacheEventStore({ schemaVersion: 1, events: [event("valid"), { id: "broken" }] });
    expect(store.events).toEqual([expect.objectContaining({ id: "valid" })]);
  });

  it("round-trips a complete versioned JSON backup", () => {
    const original = event("complete", { severity: null, symptoms: ["aroundEyes", "lightOrSound"], weatherSnapshot: {
      pressureHpa: 999.8, temperatureC: 18.2, condition: "雨", weatherCode: 63,
      observedAt: "2026-09-13T00:45:00.000Z", fetchedAt: "2026-09-13T00:48:00.000Z", source: "Open-Meteo",
    } });
    expect(headacheEventsFromBackupJson(headacheEventsToBackupJson([original], "2026-09-13T02:00:00.000Z"))).toEqual([original]);
  });

  it("builds editable local timestamps and non-empty ids", () => {
    expect(localDateTimeToIso("2026-09-13", "10:30")).toBe(new Date(2026, 8, 13, 10, 30).toISOString());
    expect(localDateTimeToIso("2026-02-30", "10:30")).toBeNull();
    expect(createHeadacheEventId(1234, 0.5)).toMatch(/^headache-/);
  });
});
