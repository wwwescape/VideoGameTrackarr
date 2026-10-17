import { apiClient } from "./client";
import { buildGameFilterParams, type GameListFilters } from "./games";
import type { GameSummary, LibraryPlatform, PlatformResponse } from "./types";

export async function listPlatforms(): Promise<PlatformResponse[]> {
  const response = await apiClient.get<PlatformResponse[]>("/api/platforms");
  return response.data;
}

export async function listLibraryPlatforms(): Promise<LibraryPlatform[]> {
  const response = await apiClient.get<LibraryPlatform[]>("/api/platforms/library");
  return response.data;
}

export async function getPlatform(slugOrId: string): Promise<PlatformResponse> {
  const response = await apiClient.get<PlatformResponse>(`/api/platforms/${slugOrId}`);
  return response.data;
}

export async function listPlatformAddons(
  slugOrId: string,
  filters: GameListFilters = {},
  signal?: AbortSignal
): Promise<GameSummary[]> {
  const response = await apiClient.get<GameSummary[]>(`/api/platforms/${slugOrId}/addons`, {
    params: buildGameFilterParams(filters),
    paramsSerializer: { indexes: null },
    signal,
  });
  return response.data;
}
