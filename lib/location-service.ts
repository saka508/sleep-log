import * as Location from "expo-location";

import { WeatherError, type Coordinates } from "./weather-service";

export type LocationRequestMode = "manual" | "automatic";

/**
 * Android/native location access is strictly foreground and one-shot. The
 * automatic path only reads permission state, so it can never open a prompt.
 */
export async function requestCurrentCoordinates(mode: LocationRequestMode = "manual"): Promise<Coordinates> {
  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted && mode === "manual") {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (!permission.granted) {
    const message = mode === "automatic"
      ? "位置情報が許可されていないため、自動更新は行いません。"
      : "位置情報の利用が拒否されました。端末の設定で位置情報を許可して、もう一度お試しください。";
    throw new WeatherError("permission-denied", message);
  }

  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    throw new WeatherError("position-unavailable", "現在地を取得できませんでした。端末の位置情報設定と通信状態を確認してください。");
  }
}

export async function hasForegroundLocationPermission() {
  return (await Location.getForegroundPermissionsAsync()).granted;
}
