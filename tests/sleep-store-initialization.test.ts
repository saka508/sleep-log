import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));
vi.mock("@/lib/sleep-utils", async () => import("../lib/sleep-utils"));
vi.mock(
  "@/lib/storage-persistence",
  async () => import("../lib/storage-persistence"),
);
vi.mock("@/lib/condition-model", () => ({
  dailyConditionsFromSleepRecords: () => [],
}));

// Vitest hoists these mocks before loading the module under test.
// eslint-disable-next-line import/first
import { loadInitialSleepData } from "../lib/sleep-store";

describe("loadInitialSleepData", () => {
  it("does not write samples when the stored data cannot be read", async () => {
    const setItem = vi.fn();
    const result = await loadInitialSleepData({
      getItem: async () => {
        throw new Error("storage unavailable");
      },
      setItem,
    });

    expect(result).toMatchObject({
      startupStorageIssue: "read-failed",
      state: { records: [] },
    });
    expect(setItem).not.toHaveBeenCalled();
  });

  it("does not expose samples as saved when their initial write fails", async () => {
    const result = await loadInitialSleepData({
      getItem: async () => null,
      setItem: async () => {
        throw new Error("storage unavailable");
      },
    });

    expect(result).toMatchObject({
      startupStorageIssue: "sample-save-failed",
      state: { records: [] },
    });
  });

  it("uses existing stored data without writing it again", async () => {
    const setItem = vi.fn();
    const result = await loadInitialSleepData({
      getItem: async () =>
        JSON.stringify({ records: [], settings: { reminderTime: "21:30" } }),
      setItem,
    });

    expect(result.startupStorageIssue).toBeNull();
    expect(result.state).toMatchObject({
      records: [],
      settings: { reminderTime: "21:30" },
    });
    expect(setItem).not.toHaveBeenCalled();
  });
});
