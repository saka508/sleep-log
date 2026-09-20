import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasForegroundLocationPermission, requestCurrentCoordinates } from "../lib/location-service";

const location = vi.hoisted(() => ({
  getForegroundPermissionsAsync: vi.fn(),
  requestForegroundPermissionsAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
  Accuracy: { Balanced: 3 },
}));

vi.mock("expo-location", () => location);

describe("native foreground location service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests a foreground permission only for an explicit manual update", async () => {
    location.getForegroundPermissionsAsync.mockResolvedValue({ granted: false });
    location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true });
    location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 35.6, longitude: 139.7 } });

    await expect(requestCurrentCoordinates("manual")).resolves.toEqual({ latitude: 35.6, longitude: 139.7 });
    expect(location.requestForegroundPermissionsAsync).toHaveBeenCalledOnce();
    expect(location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 3 });
  });

  it("does not open a permission dialog during an automatic update", async () => {
    location.getForegroundPermissionsAsync.mockResolvedValue({ granted: false });

    await expect(requestCurrentCoordinates("automatic")).rejects.toMatchObject({ code: "permission-denied" });
    expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("reports existing foreground permission without requesting it", async () => {
    location.getForegroundPermissionsAsync.mockResolvedValue({ granted: true });

    await expect(hasForegroundLocationPermission()).resolves.toBe(true);
    expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
});
