import { describe, expect, it } from "vitest";

import { homeWeatherStatusMessage } from "../lib/home-weather";

describe("home weather status", () => {
  it("distinguishes cached, updating, and refreshed weather", () => {
    expect(homeWeatherStatusMessage("cached", true)).toContain("保存済み");
    expect(homeWeatherStatusMessage("updating", true)).toContain("更新しています");
    expect(homeWeatherStatusMessage("fresh", true)).toContain("更新しました");
  });

  it("keeps cached weather visible after a location or network failure", () => {
    expect(homeWeatherStatusMessage("error", true, "permission-denied")).toBe(
      "位置情報が許可されていません。保存済みの天候を引き続き表示します。",
    );
    expect(homeWeatherStatusMessage("error", true, "network")).toBe(
      "天候を更新できませんでした。保存済みの天候を引き続き表示します。",
    );
  });

  it("does not claim a cache exists when no weather is available", () => {
    expect(homeWeatherStatusMessage("idle", false)).toBe("保存済みの天候はありません");
    expect(homeWeatherStatusMessage("error", false, "location-unsupported")).toBe(
      "この環境では位置情報を利用できません。天候なしでも記録できます。",
    );
  });
});
