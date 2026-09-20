import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestCurrentCoordinates } from "../lib/location-service.web";

const browserLocation = vi.hoisted(() => ({ requestCurrentCoordinates: vi.fn() }));

vi.mock("../lib/weather-service", () => ({
  WeatherError: class WeatherError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  requestCurrentCoordinates: browserLocation.requestCurrentCoordinates,
}));

describe("web foreground location service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not call browser geolocation automatically when permission is not already granted", async () => {
    const query = vi.fn().mockResolvedValue({ state: "prompt" });
    vi.stubGlobal("navigator", { permissions: { query } });

    await expect(requestCurrentCoordinates("automatic")).rejects.toMatchObject({ code: "permission-denied" });
    expect(browserLocation.requestCurrentCoordinates).not.toHaveBeenCalled();
  });

  it("keeps explicit manual updates on the existing browser geolocation path", async () => {
    browserLocation.requestCurrentCoordinates.mockResolvedValue({ latitude: 35.6, longitude: 139.7 });

    await expect(requestCurrentCoordinates("manual")).resolves.toEqual({ latitude: 35.6, longitude: 139.7 });
    expect(browserLocation.requestCurrentCoordinates).toHaveBeenCalledOnce();
  });
});
