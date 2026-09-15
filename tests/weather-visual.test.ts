import { describe, expect, it } from "vitest";

import { weatherVisualTypeFromCode } from "../lib/weather-visual";

describe("weather visual categories", () => {
  it.each([
    [0, "clear"],
    [1, "partlyCloudy"],
    [2, "partlyCloudy"],
    [3, "cloudy"],
    [45, "fog"],
    [51, "drizzle"],
    [61, "rain"],
    [71, "snow"],
    [80, "rain"],
    [85, "snow"],
    [95, "thunderstorm"],
    [99, "thunderstorm"],
    [999, "unknown"],
  ] as const)("maps WMO code %s to %s", (weatherCode, expected) => {
    expect(weatherVisualTypeFromCode(weatherCode)).toBe(expected);
  });

  it("uses the neutral scene when no weather was acquired", () => {
    expect(weatherVisualTypeFromCode()).toBe("unknown");
  });
});
