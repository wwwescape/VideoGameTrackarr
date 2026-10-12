import { apiClient } from "./client";
import { buildGameFilterParams, type GameListFilters } from "./games";
import type { CatalogBrowseResult, GameSummary, PlatformResponse } from "./types";

export async function listPlatforms(): Promise<PlatformResponse[]> {
  const response = await apiClient.get<PlatformResponse[]>("/api/platforms");
  return response.data;
}

export async function getPlatform(slug: string): Promise<CatalogBrowseResult> {
  const response = await apiClient.get<CatalogBrowseResult>(`/api/platforms/${slug}`);
  return response.data;
}

export async function listPlatformAddons(
  slug: string,
  filters: GameListFilters = {},
  signal?: AbortSignal
): Promise<GameSummary[]> {
  const response = await apiClient.get<GameSummary[]>(`/api/platforms/${slug}/addons`, {
    params: buildGameFilterParams(filters),
    paramsSerializer: { indexes: null },
    signal,
  });
  return response.data;
}
