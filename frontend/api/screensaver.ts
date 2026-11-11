import { apiClient } from "./client";
import type { ScreensaverSample } from "./types";

// The Screensaver lab (404 while it's off). Each call is a fresh random sample.
export async function getScreensaverSample(): Promise<ScreensaverSample> {
  const response = await apiClient.get<ScreensaverSample>("/api/games/screensaver");
  return response.data;
}

// Opts one game out of the screensaver (or back in).
export async function setScreensaverExcluded(gameId: number, excluded: boolean): Promise<boolean> {
  const response = await apiClient.put<{ id: number; excluded: boolean }>(`/api/games/${gameId}/screensaver`, {
    excluded,
  });
  return response.data.excluded;
}

// The Games list's bulk Hide/Show; returns how many games were changed.
export async function setScreensaverExcludedBulk(gameIds: number[], excluded: boolean): Promise<number> {
  const response = await apiClient.post<{ updated: number }>("/api/games/screensaver/bulk", { gameIds, excluded });
  return response.data.updated;
}
