export type WeatherVisualType =
  | "clear"
  | "partlyCloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunderstorm"
  | "unknown";

export type WeatherIconName =
  | "cloud-off"
  | "wb-sunny"
  | "cloud"
  | "thunderstorm"
  | "ac-unit"
  | "grain"
  | "water-drop";

export function weatherIconNameFromCode(weatherCode?: number): WeatherIconName {
  if (weatherCode === undefined) return "cloud-off";
  if (weatherCode === 0 || weatherCode === 1) return "wb-sunny";
  if (weatherCode === 2 || weatherCode === 3) return "cloud";
  if (weatherCode >= 95) return "thunderstorm";
  if (weatherCode >= 71 && weatherCode <= 86) return "ac-unit";
  if (weatherCode >= 51 && weatherCode <= 67) return "grain";
  return "water-drop";
}

/**
 * Maps the WMO weather code to a stable presentation category.
 * Text labels remain the responsibility of weatherCodeToJapanese().
 */
export function weatherVisualTypeFromCode(weatherCode?: number): WeatherVisualType {
  if (weatherCode === 0) return "clear";
  if (weatherCode === 1 || weatherCode === 2) return "partlyCloudy";
  if (weatherCode === 3) return "cloudy";
  if (weatherCode === 45 || weatherCode === 48) return "fog";
  if ([51, 53, 55, 56, 57].includes(weatherCode ?? Number.NaN)) return "drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode ?? Number.NaN)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode ?? Number.NaN)) return "snow";
  if ([95, 96, 99].includes(weatherCode ?? Number.NaN)) return "thunderstorm";
  return "unknown";
}
