import { apiClient } from "./client";
import type {
  GameCategory,
  GameDetail,
  GameSortOption,
  GameSummary,
  ManualGameInput,
  MediaFormat,
} from "./types";

export interface GameListFilters {
  search?: string;
  platformIds?: number[];
  platformExclude?: boolean;
  tagIds?: number[];
  tagExclude?: boolean;
  collectionIds?: number[];
  collectionExclude?: boolean;
  franchiseIds?: number[];
  franchiseExclude?: boolean;
  categories?: GameCategory[];
  categoryExclude?: boolean;
  formats?: MediaFormat[];
  formatExclude?: boolean;
  storefronts?: string[];
  storefrontExclude?: boolean;
  sort?: GameSortOption;
  // Only meaningful on GET /api/games — an always-applied AND-scope, independent of the
  // collectionIds/franchiseIds OR-filter above. Used by a Collection/Series detail page's
  // "Games" section (CatalogBrowseGrid.tsx) to hard-scope to its own entity while still
  // letting every other field filter on top. See game_repository.list_top_level_games.
  requiredCollectionId?: number;
  requiredFranchiseId?: number;
}

// Shared by listGames below and CatalogBrowseGrid.tsx's Addons-section fetches
// (listCollectionAddons/listFranchiseAddons in api/collections.ts/api/franchises.ts) — all
// three hit an endpoint backed by the same backend GameFilterParams dependency, so the
// alias-mapping only needs writing once.
export function buildGameFilterParams(filters: GameListFilters) {
  const {
    search,
    platformIds,
    platformExclude,
    tagIds,
    tagExclude,
    collectionIds,
    collectionExclude,
    franchiseIds,
    franchiseExclude,
    categories,
    categoryExclude,
    formats,
    formatExclude,
    storefronts,
    storefrontExclude,
    sort,
    requiredCollectionId,
    requiredFranchiseId,
  } = filters;
  return {
    search: search || undefined,
    platformId: platformIds?.length ? platformIds : undefined,
    platformExclude: platformIds?.length ? platformExclude : undefined,
    tagId: tagIds?.length ? tagIds : undefined,
    tagExclude: tagIds?.length ? tagExclude : undefined,
    collectionId: collectionIds?.length ? collectionIds : undefined,
    collectionExclude: collectionIds?.length ? collectionExclude : undefined,
    franchiseId: franchiseIds?.length ? franchiseIds : undefined,
    franchiseExclude: franchiseIds?.length ? franchiseExclude : undefined,
    category: categories?.length ? categories : undefined,
    categoryExclude: categories?.length ? categoryExclude : undefined,
    format: formats?.length ? formats : undefined,
    formatExclude: formats?.length ? formatExclude : undefined,
    storefront: storefronts?.length ? storefronts : undefined,
    storefrontExclude: storefronts?.length ? storefrontExclude : undefined,
    sort: sort || undefined,
    requiredCollectionId,
    requiredFranchiseId,
  };
}

export async function listGames(
  filters: GameListFilters = {},
  signal?: AbortSignal
): Promise<GameSummary[]> {
  const response = await apiClient.get<GameSummary[]>("/api/games", {
    params: buildGameFilterParams(filters),
    // Axios's default array serialization emits `tagId[]=1`, which FastAPI's `list[int]`
    // Query param won't bind under the `tagId` alias — this repeats the bare key instead
    // (`tagId=1&tagId=2`), matching what the backend actually parses.
    paramsSerializer: { indexes: null },
    signal,
  });
  return response.data;
}

export async function getGame(identifier: string): Promise<GameDetail> {
  const response = await apiClient.get<GameDetail>(`/api/games/${identifier}`);
  return response.data;
}

export async function listAddons(gameId: number): Promise<GameSummary[]> {
  const response = await apiClient.get<GameSummary[]>(`/api/games/${gameId}/addons`);
  return response.data;
}

export async function deleteGame(gameId: number): Promise<void> {
  await apiClient.delete(`/api/games/${gameId}`);
}

export async function importGame(igdbId: number): Promise<GameDetail> {
  const response = await apiClient.post<GameDetail>("/api/games", { igdbId });
  return response.data;
}

export async function resyncGame(gameId: number): Promise<GameDetail> {
  const response = await apiClient.post<GameDetail>(`/api/games/${gameId}/resync`);
  return response.data;
}

export async function claimDiscoveredGame(gameId: number): Promise<GameDetail> {
  const response = await apiClient.post<GameDetail>(`/api/games/${gameId}/claim`);
  return response.data;
}

export async function linkGameToIgdb(gameId: number, igdbId: number): Promise<GameDetail> {
  const response = await apiClient.post<GameDetail>(`/api/games/${gameId}/link-igdb`, { igdbId });
  return response.data;
}

export async function linkGameToIgdbViaParent(gameId: number, igdbId: number): Promise<GameDetail> {
  const response = await apiClient.post<GameDetail>(`/api/games/${gameId}/link-igdb-via-parent`, {
    igdbId,
  });
  return response.data;
}

export async function mergeGameIntoIgdb(gameId: number, igdbId: number): Promise<GameDetail> {
  const response = await apiClient.post<GameDetail>(`/api/games/${gameId}/merge-into-igdb`, {
    igdbId,
  });
  return response.data;
}

export async function createManualGame(input: ManualGameInput): Promise<GameDetail> {
  const response = await apiClient.post<GameDetail>("/api/games/manual", input);
  return response.data;
}

export async function updateManualGame(
  gameId: number,
  input: Partial<ManualGameInput>
): Promise<GameDetail> {
  const response = await apiClient.patch<GameDetail>(`/api/games/${gameId}/manual`, input);
  return response.data;
}
