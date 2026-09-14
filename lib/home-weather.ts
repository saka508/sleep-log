import type { WeatherErrorCode } from "./weather-service";

export type HomeWeatherStatus = "idle" | "cached" | "updating" | "fresh" | "error";

export function homeWeatherStatusMessage(
  status: HomeWeatherStatus,
  hasWeather: boolean,
  errorCode?: WeatherErrorCode,
) {
  if (status === "updating") return "現在地から天候を更新しています…";
  if (status === "fresh") return "現在の天候へ更新しました";
  if (status === "cached") return "保存済みの天候を表示中";
  if (status === "idle") return "保存済みの天候はありません";

  const fallback = hasWeather ? "保存済みの天候を引き続き表示します。" : "天候なしでも記録できます。";
  if (errorCode === "permission-denied") return `位置情報が許可されていません。${fallback}`;
  if (errorCode === "location-unsupported") return `この環境では位置情報を利用できません。${fallback}`;
  if (errorCode === "position-unavailable" || errorCode === "location-timeout") {
    return `現在地を取得できませんでした。${fallback}`;
  }
  return `天候を更新できませんでした。${fallback}`;
}
