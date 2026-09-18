import { describe, expect, it } from "vitest";

import { weatherIconNameFromCode, weatherVisualTypeFromCode } from "../lib/weather-visual";

describe("weather icon names", () => {
  it.each([
    [undefined, "cloud-off"],
    [0, "wb-sunny"],
    [1, "wb-sunny"],
    [2, "cloud"],
    [3, "cloud"],
    [95, "thunderstorm"],
  ] as const)("maps weather code %s to %s", (weatherCode, expected) => {
    expect(weatherIconNameFromCode(weatherCode)).toBe(expected);
  });
});

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
