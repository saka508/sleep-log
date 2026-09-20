import { WeatherError, requestCurrentCoordinates as requestBrowserCoordinates } from "./weather-service";

export type LocationRequestMode = "manual" | "automatic";

/** Web keeps the existing browser Geolocation API path for explicit updates. */
export async function requestCurrentCoordinates(mode: LocationRequestMode = "manual") {
  if (mode === "automatic" && !(await hasForegroundLocationPermission())) {
    throw new WeatherError("permission-denied", "位置情報が許可されていないため、自動更新は行いません。");
  }
  return requestBrowserCoordinates();
}

/** Browsers without the Permissions API simply skip automatic refresh. */
export async function hasForegroundLocationPermission() {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return false;
  try {
    return (await navigator.permissions.query({ name: "geolocation" as PermissionName })).state === "granted";
  } catch {
    return false;
  }
}
