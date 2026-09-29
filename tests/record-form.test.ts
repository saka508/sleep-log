import { describe, expect, it } from "vitest";

import { parseNapDuration } from "../lib/record-form";

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
