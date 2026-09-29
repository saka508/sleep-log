import { describe, expect, it } from "vitest";

import { optionalScoreValueForChoice } from "../lib/optional-score";

describe("optional score input state", () => {
  it("does not create a zero merely by opening the score picker", () => {
    expect(optionalScoreValueForChoice("record", undefined)).toBeUndefined();
    expect(optionalScoreValueForChoice("record", 0)).toBe(0);
  });

  it("clears the persisted field only when the user chooses unrecorded", () => {
    expect(optionalScoreValueForChoice("none", 0)).toBeUndefined();
  });
});
