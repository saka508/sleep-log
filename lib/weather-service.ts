import type { WeatherSnapshot } from "./sleep-utils";

export const OPEN_METEO_ATTRIBUTION_URL = "https://open-meteo.com/";
const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export type WeatherErrorCode =
  | "location-unsupported"
  | "permission-denied"
  | "position-unavailable"
  | "location-timeout"
  | "network"
  | "invalid-response";

export class WeatherError extends Error {
  constructor(public readonly code: WeatherErrorCode, message: string) {
    super(message);
    this.name = "WeatherError";
  }
}

type Coordinates = { latitude: number; longitude: number };
type GeolocationProvider = Pick<Geolocation, "getCurrentPosition">;
type FetchProvider = typeof fetch;

export function weatherCodeToJapanese(code: number) {
  if (code === 0) return "快晴";
  if (code === 1) return "晴れ";
  if (code === 2) return "一部曇り";
  if (code === 3) return "曇り";
  if ([45, 48].includes(code)) return "霧";
  if ([51, 53, 55].includes(code)) return "霧雨";
  if ([56, 57].includes(code)) return "着氷性の霧雨";
  if ([61, 63, 65].includes(code)) return "雨";
  if ([66, 67].includes(code)) return "着氷性の雨";
  if ([71, 73, 75].includes(code)) return "雪";
  if (code === 77) return "霧雪";
  if ([80, 81, 82].includes(code)) return "にわか雨";
  if ([85, 86].includes(code)) return "にわか雪";
  if (code === 95) return "雷雨";
  if ([96, 99].includes(code)) return "ひょうを伴う雷雨";
  return "不明";
}

export function buildOpenMeteoUrl({ latitude, longitude }: Coordinates) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,surface_pressure,weather_code",
    timezone: "auto",
  });
  return `${OPEN_METEO_FORECAST_URL}?${params.toString()}`;
}

export function requestCurrentCoordinates(provider?: GeolocationProvider): Promise<Coordinates> {
  const geolocation = provider ?? (typeof navigator !== "undefined" ? navigator.geolocation : undefined);
  if (!geolocation) {
    return Promise.reject(new WeatherError("location-unsupported", "この環境では位置情報を利用できません。HTTPSの公開ページをブラウザで開いてください。"));
  }

  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => {
        if (error.code === 1) reject(new WeatherError("permission-denied", "位置情報の利用が拒否されました。ブラウザのサイト設定で位置情報を許可して、もう一度お試しください。"));
        else if (error.code === 2) reject(new WeatherError("position-unavailable", "現在地を取得できませんでした。端末の位置情報設定と通信状態を確認してください。"));
        else reject(new WeatherError("location-timeout", "現在地の取得が時間切れになりました。電波の届きやすい場所で、もう一度お試しください。"));
      },
      { enableHighAccuracy: false, maximumAge: 0, timeout: 15_000 },
    );
  });
}

export async function fetchCurrentWeather(coordinates: Coordinates, fetcher: FetchProvider = fetch): Promise<WeatherSnapshot> {
  let response: Response;
  try {
    response = await fetcher(buildOpenMeteoUrl(coordinates), { headers: { Accept: "application/json" } });
  } catch {
    throw new WeatherError("network", "天気APIに接続できませんでした。通信状態を確認してください。睡眠・体調の記録は天候なしでも保存できます。");
  }
  if (!response.ok) {
    throw new WeatherError("network", "天気APIからデータを取得できませんでした。しばらくしてから、もう一度お試しください。");
  }

  const body = await response.json() as { current?: { temperature_2m?: unknown; surface_pressure?: unknown; weather_code?: unknown } };
  const temperatureC = Number(body.current?.temperature_2m);
  const pressureHpa = Number(body.current?.surface_pressure);
  const weatherCode = Number(body.current?.weather_code);
  if (![temperatureC, pressureHpa, weatherCode].every(Number.isFinite)) {
    throw new WeatherError("invalid-response", "天気APIの応答を読み取れませんでした。しばらくしてから、もう一度お試しください。");
  }

  return {
    pressureHpa: Math.round(pressureHpa * 10) / 10,
    temperatureC: Math.round(temperatureC * 10) / 10,
    condition: weatherCodeToJapanese(weatherCode),
    weatherCode: Math.round(weatherCode),
    fetchedAt: new Date().toISOString(),
    source: "Open-Meteo",
  };
}

export async function fetchWeatherForCurrentLocation(options: { geolocation?: GeolocationProvider; fetcher?: FetchProvider } = {}) {
  const coordinates = await requestCurrentCoordinates(options.geolocation);
  return fetchCurrentWeather(coordinates, options.fetcher);
}

