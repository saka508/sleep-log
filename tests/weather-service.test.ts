import { describe, expect, it, vi } from "vitest";

import {
  buildOpenMeteoUrl,
  fetchCurrentWeather,
  requestCurrentCoordinates,
  weatherCodeToJapanese,
} from "../lib/weather-service";

describe("Open-Meteo weather service", () => {
  it("requests only the current fields used by the app", () => {
    const url = new URL(buildOpenMeteoUrl({ latitude: 35.6812, longitude: 139.7671 }));
    expect(url.origin + url.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(url.searchParams.get("current")).toBe("temperature_2m,surface_pressure,weather_code");
    expect(url.searchParams.get("latitude")).toBe("35.6812");
    expect(url.searchParams.get("longitude")).toBe("139.7671");
  });

  it("converts WMO codes to readable Japanese", () => {
    expect(weatherCodeToJapanese(0)).toBe("快晴");
    expect(weatherCodeToJapanese(63)).toBe("雨");
    expect(weatherCodeToJapanese(95)).toBe("雷雨");
    expect(weatherCodeToJapanese(999)).toBe("不明");
  });

  it("normalizes the API response without retaining coordinates", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      current: { temperature_2m: 27.24, surface_pressure: 1002.86, weather_code: 2 },
    }), { status: 200 }));

    const weather = await fetchCurrentWeather({ latitude: 35, longitude: 139 }, fetcher);
    expect(weather).toMatchObject({
      pressureHpa: 1002.9,
      temperatureC: 27.2,
      condition: "一部曇り",
      weatherCode: 2,
      source: "Open-Meteo",
    });
    expect(weather).not.toHaveProperty("latitude");
    expect(weather).not.toHaveProperty("longitude");
    expect(Number.isFinite(Date.parse(weather.fetchedAt))).toBe(true);
  });

  it.each([
    [1, "permission-denied"],
    [2, "position-unavailable"],
    [3, "location-timeout"],
  ])("classifies geolocation error %s as %s", async (browserCode, expectedCode) => {
    const geolocation = {
      getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => error({ code: browserCode } as GeolocationPositionError),
    } as Geolocation;

    await expect(requestCurrentCoordinates(geolocation)).rejects.toMatchObject({ code: expectedCode });
  });

  it("classifies network failures while leaving record saving independent", async () => {
    const fetcher = vi.fn(async () => { throw new TypeError("offline"); });
    await expect(fetchCurrentWeather({ latitude: 35, longitude: 139 }, fetcher)).rejects.toMatchObject({ code: "network" });
  });

  it("rejects incomplete API data instead of saving an uncertain value", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ current: { temperature_2m: 22 } }), { status: 200 }));
    await expect(fetchCurrentWeather({ latitude: 35, longitude: 139 }, fetcher)).rejects.toMatchObject({ code: "invalid-response" });
  });
});
