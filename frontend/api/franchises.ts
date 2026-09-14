import { apiClient } from "./client";
import { buildGameFilterParams, type GameListFilters } from "./games";
import type { CatalogBrowseResult, CatalogRefSummary, GameSummary } from "./types";

export async function listFranchises(): Promise<CatalogRefSummary[]> {
  const response = await apiClient.get<CatalogRefSummary[]>("/api/franchises");
  return response.data;
}

export async function getFranchise(slug: string): Promise<CatalogBrowseResult> {
  const response = await apiClient.get<CatalogBrowseResult>(`/api/franchises/${slug}`);
  return response.data;
}

export async function listFranchiseAddons(
  slug: string,
  filters: GameListFilters = {},
  signal?: AbortSignal
): Promise<GameSummary[]> {
  const response = await apiClient.get<GameSummary[]>(`/api/franchises/${slug}/addons`, {
    params: buildGameFilterParams(filters),
    paramsSerializer: { indexes: null },
    signal,
  });
  return response.data;
}
