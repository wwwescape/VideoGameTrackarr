import { apiClient } from "./client";
import type {
  BulkImportRequest,
  BulkImportStatusResponse,
  GameCategory,
  GameDetail,
  GameSource,
  GameSortOption,
  GameSummary,
  ManualGameInput,
  MediaFormat,
  PlayStatus,
} from "./types";

// Filters with an "Any / All" choice in the Filters dialog. Each one is off ("Any": a game
// matches if it has at least one selected value) unless set. Kept as one map, not a separate
// flag per filter, so a page holds a single remembered value for all of them. Ownership is
// applied client-side (it's never sent); the rest map to the backend's xxxMatchAll params.
export type MatchAllField =
  | "ownership"
  | "platform"
  | "tag"
  | "collection"
  | "franchise"
  | "format"
  | "storefront"
  | "playStatus";
export type MatchAllFilters = Partial<Record<MatchAllField, boolean>>;

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
  playStatuses?: PlayStatus[];
  playStatusExclude?: boolean;
  matchAll?: MatchAllFilters;
  // Plain boolean, unlike every filter above — a copy either is or isn't a Steelbook, so
  // there's no list/Exclude pair for it. See game_repository._apply_optional_game_filters.
  steelbookOnly?: boolean;
  // No "match all", same as categories: a game is either IGDB-backed or custom.
  sources?: GameSource[];
  sourceExclude?: boolean;
  sort?: GameSortOption;
  // Only meaningful on GET /api/games — an always-applied AND-scope, independent of the
  // collectionIds/franchiseIds OR-filter above. Used by a Collection/Series detail page's
  // "Games" section (CatalogBrowseGrid.tsx) to hard-scope to its own entity while still
  // letting every other field filter on top. See game_repository.list_top_level_games.
  requiredCollectionId?: number;
  requiredFranchiseId?: number;
  requiredPlatformId?: number;
  // With requiredPlatformId, for a PC storefront card's page (see utils/platformScope.ts).
  requiredPlatformFormat?: MediaFormat;
  requiredPlatformStorefront?: string;
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
    playStatuses,
    playStatusExclude,
    matchAll,
    steelbookOnly,
    sources,
    sourceExclude,
    sort,
    requiredCollectionId,
    requiredFranchiseId,
    requiredPlatformId,
    requiredPlatformFormat,
    requiredPlatformStorefront,
  } = filters;
  // Only sent when it can change the result: "all" of a single value is the same as "any".
  const matchAllParam = (field: MatchAllField, values: unknown[] | undefined) =>
    values && values.length > 1 && matchAll?.[field] ? true : undefined;
  return {
    search: search || undefined,
    platformId: platformIds?.length ? platformIds : undefined,
    platformExclude: platformIds?.length ? platformExclude : undefined,
    platformMatchAll: matchAllParam("platform", platformIds),
    tagId: tagIds?.length ? tagIds : undefined,
    tagExclude: tagIds?.length ? tagExclude : undefined,
    tagMatchAll: matchAllParam("tag", tagIds),
    collectionId: collectionIds?.length ? collectionIds : undefined,
    collectionExclude: collectionIds?.length ? collectionExclude : undefined,
    collectionMatchAll: matchAllParam("collection", collectionIds),
    franchiseId: franchiseIds?.length ? franchiseIds : undefined,
    franchiseExclude: franchiseIds?.length ? franchiseExclude : undefined,
    franchiseMatchAll: matchAllParam("franchise", franchiseIds),
    category: categories?.length ? categories : undefined,
    categoryExclude: categories?.length ? categoryExclude : undefined,
    format: formats?.length ? formats : undefined,
    formatExclude: formats?.length ? formatExclude : undefined,
    formatMatchAll: matchAllParam("format", formats),
    storefront: storefronts?.length ? storefronts : undefined,
    storefrontExclude: storefronts?.length ? storefrontExclude : undefined,
    storefrontMatchAll: matchAllParam("storefront", storefronts),
    playStatus: playStatuses?.length ? playStatuses : undefined,
    playStatusExclude: playStatuses?.length ? playStatusExclude : undefined,
    playStatusMatchAll: matchAllParam("playStatus", playStatuses),
    steelbookOnly: steelbookOnly || undefined,
    source: sources?.length ? sources : undefined,
    sourceExclude: sources?.length ? sourceExclude : undefined,
    sort: sort || undefined,
    requiredCollectionId,
    requiredFranchiseId,
    requiredPlatformId,
    requiredPlatformFormat,
    requiredPlatformStorefront,
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

export async function startBulkImport(request: BulkImportRequest): Promise<BulkImportStatusResponse> {
  const response = await apiClient.post<BulkImportStatusResponse>("/api/games/bulk-import", request);
  return response.data;
}

export async function getBulkImportStatus(): Promise<BulkImportStatusResponse> {
  const response = await apiClient.get<BulkImportStatusResponse>("/api/games/bulk-import/status");
  return response.data;
}

export async function acknowledgeBulkImportStatus(): Promise<void> {
  await apiClient.post("/api/games/bulk-import/status/acknowledge");
}

export async function resyncGame(gameId: number): Promise<GameDetail> {
  const response = await apiClient.post<GameDetail>(`/api/games/${gameId}/resync`);
  return response.data;
}

// Your overall rating, 1-10 stars; null clears it.
export async function setGameRating(gameId: number, rating: number | null): Promise<number | null> {
  const response = await apiClient.put<{ rating: number | null }>(`/api/games/${gameId}/rating`, { rating });
  return response.data.rating;
}

// Unlink from IGDB: a game linked from custom becomes custom again (its add-ons are removed).
export async function unlinkGameFromIgdb(gameId: number): Promise<GameDetail> {
  const response = await apiClient.post<GameDetail>(`/api/games/${gameId}/unlink-igdb`);
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
