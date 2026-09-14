import { describe, expect, it } from "vitest";

import { persistJson, persistJsonAndCommit, persistValue } from "../lib/storage-persistence";

describe("persistJson", () => {
  it("waits for a successful AsyncStorage write", async () => {
    let written: string | undefined;
    const result = await persistJson({
      setItem: async (_key, value) => {
        await Promise.resolve();
        written = value;
      },
    }, "sleep-log.local-data.v1", { records: [{ date: "2026-09-14" }] });

    expect(result).toBe(true);
    expect(written).toBe('{"records":[{"date":"2026-09-14"}]}');
  });

  it("returns failure when AsyncStorage rejects", async () => {
    let committed = false;
    const result = await persistJsonAndCommit({
      setItem: async () => {
        throw new Error("storage unavailable");
      },
    }, "sleep-log.local-data.v1", { records: [] }, () => {
      committed = true;
    });

    expect(result).toBe(false);
    expect(committed).toBe(false);
  });

  it("commits only after AsyncStorage finishes", async () => {
    const order: string[] = [];
    const result = await persistJsonAndCommit({
      setItem: async () => {
        order.push("write-start");
        await Promise.resolve();
        order.push("write-finish");
      },
    }, "sleep-log.headache-events.v1", { events: [] }, () => {
      order.push("commit");
    });

    expect(result).toBe(true);
    expect(order).toEqual(["write-start", "write-finish", "commit"]);
  });

  it("returns failure when the value cannot be serialized", async () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    const result = await persistJson({
      setItem: async () => undefined,
    }, "sleep-log.local-data.v1", circular);

    expect(result).toBe(false);
  });

  it("preserves non-JSON storage values such as the theme preference", async () => {
    let written: string | undefined;
    const result = await persistValue({
      setItem: async (_key, value) => {
        written = value;
      },
    }, "sleep-log.theme", "dark");

    expect(result).toBe(true);
    expect(written).toBe("dark");
  });
});
