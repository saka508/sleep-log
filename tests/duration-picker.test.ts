import { describe, expect, it } from "vitest";

import {
  durationMinutesFromParts,
  durationPartsFromMinutes,
  formatDurationParts,
} from "../lib/duration-picker";

describe("duration picker conversion", () => {
  it("converts zero and upper boundary values", () => {
    expect(durationMinutesFromParts(0, 0)).toBe(0);
    expect(durationMinutesFromParts(24, 0)).toBe(1440);
    expect(durationMinutesFromParts(23, 59)).toBe(1439);
    expect(durationMinutesFromParts(24, 59)).toBeNull();
  });

  it("converts minutes across an hour boundary", () => {
    expect(durationPartsFromMinutes(59)).toEqual({ hours: 0, minutes: 59 });
    expect(durationPartsFromMinutes(60)).toEqual({ hours: 1, minutes: 0 });
    expect(durationPartsFromMinutes(391)).toEqual({ hours: 6, minutes: 31 });
  });

  it("rejects non-integer and out-of-range selections", () => {
    expect(durationMinutesFromParts(-1, 0)).toBeNull();
    expect(durationMinutesFromParts(0, 60)).toBeNull();
    expect(durationMinutesFromParts(1.5, 0)).toBeNull();
    expect(durationPartsFromMinutes(-1)).toBeNull();
    expect(durationPartsFromMinutes(1441)).toBeNull();
  });

  it("keeps a confirmed value unchanged when a draft is cancelled", () => {
    const committed = durationMinutesFromParts(6, 31)!;
    let draft = durationMinutesFromParts(7, 0)!;
    expect(committed).toBe(391);
    expect(draft).toBe(420);
    draft = committed;
    expect(committed).toBe(391);
    expect(draft).toBe(391);
    expect(formatDurationParts(durationPartsFromMinutes(committed)!)).toBe("6時間31分");
  });
});
