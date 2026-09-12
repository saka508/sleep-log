import { describe, expect, it } from "vitest";

import { dateFromParts, dateKeyFromPicker, daysInMonth, localDateForPicker, localTimeForPicker, timeFromParts, timeFromPicker } from "../lib/picker-utils";

describe("local picker helpers", () => {
  it("keeps a past calendar date on the local calendar", () => {
    const selected = localDateForPicker("2024-02-29");
    expect(dateKeyFromPicker(selected)).toBe("2024-02-29");
    expect(dateFromParts(2024, 2, 29)).toBe("2024-02-29");
    expect(dateFromParts(2025, 2, 29)).toBeNull();
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it("preserves existing minute precision until a native picker selection is made", () => {
    const selected = localTimeForPicker("07:03", new Date(2026, 8, 13, 12, 0));
    expect(selected.getHours()).toBe(7);
    expect(selected.getMinutes()).toBe(3);
    expect(timeFromPicker(new Date(2026, 8, 13, 23, 58))).toBe("00:00");
    expect(timeFromParts(0, 0)).toBe("00:00");
    expect(timeFromParts(24, 0)).toBeNull();
  });
});
