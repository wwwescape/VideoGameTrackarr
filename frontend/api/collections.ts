import { apiClient } from "./client";
import { buildGameFilterParams, type GameListFilters } from "./games";
import type { CatalogBrowseResult, CatalogRefSummary, GameSummary } from "./types";

export async function listCollections(): Promise<CatalogRefSummary[]> {
  const response = await apiClient.get<CatalogRefSummary[]>("/api/collections");
  return response.data;
}

export async function getCollection(slug: string): Promise<CatalogBrowseResult> {
  const response = await apiClient.get<CatalogBrowseResult>(`/api/collections/${slug}`);
  return response.data;
}

export async function listCollectionAddons(
  slug: string,
  filters: GameListFilters = {},
  signal?: AbortSignal
): Promise<GameSummary[]> {
  const response = await apiClient.get<GameSummary[]>(`/api/collections/${slug}/addons`, {
    params: buildGameFilterParams(filters),
    paramsSerializer: { indexes: null },
    signal,
  });
  return response.data;
}
