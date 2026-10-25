import { useMemo } from "react";
import type { MatchAllFilters } from "../api/games";
import type { GameCategory, GameSortOption, GameSource, MediaFormat, PlayStatus } from "../api/types";
import type { OwnershipStatus } from "../components/GameFilterDialog";
import { writeSessionValue } from "../utils/sessionViewState";
import { ALL_KNOWN_STOREFRONTS } from "../utils/storefronts";
import { useCollections, useFranchises } from "./useCatalogBrowse";
import { useDebouncedValue } from "./useDebouncedValue";
import { usePlatforms } from "./usePlatforms";
import { usePruneStaleIds, useSessionState } from "./useSessionState";
import { useStorefronts } from "./useStorefronts";
import { useTags } from "./useTags";

const MIN_SEARCH_LENGTH = 3;

// Which filters a page offers on top of the ones every game list has.
export interface GameListStateOptions {
  // Not on Missing Add-ons: everything there is an add-on.
  gameTypes?: boolean;
  // Games and the Series/Collection/Platform pages, not Missing Add-ons.
  steelbook?: boolean;
  // Games only: IGDB vs custom.
  sources?: boolean;
}

// Every filter a game list remembers, at its cleared value (the sort is left as it is).
const CLEARED_FILTERS = {
  searchKeyword: "",
  ownershipStatuses: [] as OwnershipStatus[],
  ownershipExclude: false,
  platformIds: [] as number[],
  platformExclude: false,
  tagIds: [] as number[],
  tagExclude: false,
  collectionIds: [] as number[],
  collectionExclude: false,
  franchiseIds: [] as number[],
  franchiseExclude: false,
  gameTypes: [] as GameCategory[],
  gameTypeExclude: false,
  formats: [] as MediaFormat[],
  formatExclude: false,
  storefronts: [] as string[],
  storefrontExclude: false,
  playStatuses: [] as PlayStatus[],
  playStatusExclude: false,
  matchAll: {} as MatchAllFilters,
  steelbookOnly: false,
  sources: [] as GameSource[],
  sourceExclude: false,
};

export type GameListPreset = Partial<typeof CLEARED_FILTERS>;

// Replaces a game list's remembered filters with just `preset`, before opening it (Overview's
// "Now playing" or "Custom games", an Insights breakdown row) — the same as setting that one
// filter by hand on a cleared list.
export function presetGameListFilters(prefix: string, preset: GameListPreset): void {
  for (const [name, cleared] of Object.entries(CLEARED_FILTERS)) {
    writeSessionValue(`${prefix}.${name}`, (preset as Record<string, unknown>)[name] ?? cleared);
  }
}

// The search, filters and sort a game list remembers for the browser session, under its own
// key prefix ("games", "collection.zelda", "missingAddons", ...) so each page keeps its own.
// Shared by the Games page, the Series/Collection/Platform pages and Missing Add-ons.
export function useGameListState(prefix: string, { gameTypes = true, steelbook = true, sources = false }: GameListStateOptions = {}) {
  const key = (name: string) => `${prefix}.${name}`;
  const [searchKeyword, setSearchKeyword] = useSessionState(key("searchKeyword"), "");
  const [ownershipStatuses, setOwnershipStatuses] = useSessionState<OwnershipStatus[]>(key("ownershipStatuses"), []);
  const [ownershipExclude, setOwnershipExclude] = useSessionState(key("ownershipExclude"), false);
  const [platformIds, setPlatformIds] = useSessionState<number[]>(key("platformIds"), []);
  const [platformExclude, setPlatformExclude] = useSessionState(key("platformExclude"), false);
  const [tagIds, setTagIds] = useSessionState<number[]>(key("tagIds"), []);
  const [tagExclude, setTagExclude] = useSessionState(key("tagExclude"), false);
  const [collectionIds, setCollectionIds] = useSessionState<number[]>(key("collectionIds"), []);
  const [collectionExclude, setCollectionExclude] = useSessionState(key("collectionExclude"), false);
  const [franchiseIds, setFranchiseIds] = useSessionState<number[]>(key("franchiseIds"), []);
  const [franchiseExclude, setFranchiseExclude] = useSessionState(key("franchiseExclude"), false);
  const [gameTypeValues, setGameTypes] = useSessionState<GameCategory[]>(key("gameTypes"), []);
  const [gameTypeExclude, setGameTypeExclude] = useSessionState(key("gameTypeExclude"), false);
  const [formats, setFormats] = useSessionState<MediaFormat[]>(key("formats"), []);
  const [formatExclude, setFormatExclude] = useSessionState(key("formatExclude"), false);
  const [storefronts, setStorefronts] = useSessionState<string[]>(key("storefronts"), []);
  const [storefrontExclude, setStorefrontExclude] = useSessionState(key("storefrontExclude"), false);
  const [playStatuses, setPlayStatuses] = useSessionState<PlayStatus[]>(key("playStatuses"), []);
  const [playStatusExclude, setPlayStatusExclude] = useSessionState(key("playStatusExclude"), false);
  const [matchAll, setMatchAll] = useSessionState<MatchAllFilters>(key("matchAll"), {});
  const [steelbookValue, setSteelbookOnly] = useSessionState(key("steelbookOnly"), false);
  const [sourceValues, setSources] = useSessionState<GameSource[]>(key("sources"), []);
  const [sourceExclude, setSourceExclude] = useSessionState(key("sourceExclude"), false);
  const [sort, setSort] = useSessionState<GameSortOption>(key("sort"), "name_asc");
  // A page without a field ignores whatever was once remembered for it.
  const gameTypesList = useMemo(() => (gameTypes ? gameTypeValues : []), [gameTypes, gameTypeValues]);
  const steelbookOnly = steelbook ? steelbookValue : false;
  const sourcesList = useMemo(() => (sources ? sourceValues : []), [sources, sourceValues]);

  const trimmedKeyword = searchKeyword.trim();
  const debouncedKeyword = useDebouncedValue(trimmedKeyword, 500);
  const isSearchActive = debouncedKeyword.length >= MIN_SEARCH_LENGTH;
  const isPendingDebounce = trimmedKeyword.length >= MIN_SEARCH_LENGTH && trimmedKeyword !== debouncedKeyword;

  const { data: platforms = [], isSuccess: platformsLoaded } = usePlatforms();
  const { data: tags = [], isSuccess: tagsLoaded } = useTags();
  const { data: collections = [], isSuccess: collectionsLoaded } = useCollections();
  const { data: franchises = [], isSuccess: franchisesLoaded } = useFranchises();
  usePruneStaleIds(platformIds, setPlatformIds, platforms, platformsLoaded);
  usePruneStaleIds(tagIds, setTagIds, tags, tagsLoaded);
  usePruneStaleIds(collectionIds, setCollectionIds, collections, collectionsLoaded);
  usePruneStaleIds(franchiseIds, setFranchiseIds, franchises, franchisesLoaded);
  const { data: realStorefronts = [] } = useStorefronts();
  // Always offer every storefront the app knows about (Steam/GOG/PlayStation Store/etc.),
  // not just whatever already happens to exist in the data — otherwise a brand-new instance
  // (or one that's simply never added a PSN/Xbox/etc. digital copy yet) would have nothing
  // to pick from for those storefronts at all.
  const storefrontOptions = useMemo(
    () => Array.from(new Set([...ALL_KNOWN_STOREFRONTS, ...realStorefronts])).sort(),
    [realStorefronts]
  );

  // What's sent to the server. Ownership is filtered client-side by each page (it needs the
  // summaries' owned/wishlisted flags), so it isn't part of this.
  const apiFilters = useMemo(
    () => ({
      search: isSearchActive ? debouncedKeyword : undefined,
      platformIds: platformIds.length > 0 ? platformIds : undefined,
      platformExclude,
      tagIds: tagIds.length > 0 ? tagIds : undefined,
      tagExclude,
      collectionIds: collectionIds.length > 0 ? collectionIds : undefined,
      collectionExclude,
      franchiseIds: franchiseIds.length > 0 ? franchiseIds : undefined,
      franchiseExclude,
      ...(gameTypes ? { categories: gameTypesList.length > 0 ? gameTypesList : undefined, categoryExclude: gameTypeExclude } : {}),
      formats: formats.length > 0 ? formats : undefined,
      formatExclude,
      storefronts: storefronts.length > 0 ? storefronts : undefined,
      storefrontExclude,
      playStatuses: playStatuses.length > 0 ? playStatuses : undefined,
      playStatusExclude,
      matchAll,
      ...(steelbook ? { steelbookOnly } : {}),
      ...(sources ? { sources: sourcesList.length > 0 ? sourcesList : undefined, sourceExclude } : {}),
      sort,
    }),
    [
      isSearchActive,
      debouncedKeyword,
      platformIds,
      platformExclude,
      tagIds,
      tagExclude,
      collectionIds,
      collectionExclude,
      franchiseIds,
      franchiseExclude,
      gameTypes,
      gameTypesList,
      gameTypeExclude,
      formats,
      formatExclude,
      storefronts,
      storefrontExclude,
      playStatuses,
      playStatusExclude,
      matchAll,
      steelbook,
      steelbookOnly,
      sources,
      sourcesList,
      sourceExclude,
      sort,
    ]
  );

  // Everything the Filter dialog (GameFilterDialog) edits.
  const fields = {
    ownershipStatuses,
    onOwnershipStatusesChange: setOwnershipStatuses,
    ownershipExclude,
    onOwnershipExcludeChange: setOwnershipExclude,
    platformOptions: platforms,
    platformIds,
    onPlatformIdsChange: setPlatformIds,
    platformExclude,
    onPlatformExcludeChange: setPlatformExclude,
    tagOptions: tags,
    tagIds,
    onTagIdsChange: setTagIds,
    tagExclude,
    onTagExcludeChange: setTagExclude,
    collectionOptions: collections,
    collectionIds,
    onCollectionIdsChange: setCollectionIds,
    collectionExclude,
    onCollectionExcludeChange: setCollectionExclude,
    franchiseOptions: franchises,
    franchiseIds,
    onFranchiseIdsChange: setFranchiseIds,
    franchiseExclude,
    onFranchiseExcludeChange: setFranchiseExclude,
    gameTypes: gameTypesList,
    onGameTypesChange: setGameTypes,
    gameTypeExclude,
    onGameTypeExcludeChange: setGameTypeExclude,
    hideGameTypesField: !gameTypes,
    formats,
    onFormatsChange: setFormats,
    formatExclude,
    onFormatExcludeChange: setFormatExclude,
    storefrontOptions,
    storefronts,
    onStorefrontsChange: setStorefronts,
    storefrontExclude,
    onStorefrontExcludeChange: setStorefrontExclude,
    ...(steelbook ? { steelbookOnly, onSteelbookOnlyChange: setSteelbookOnly } : {}),
    ...(sources ? { sources: sourcesList, onSourcesChange: setSources, sourceExclude, onSourceExcludeChange: setSourceExclude } : {}),
    playStatuses,
    onPlayStatusesChange: setPlayStatuses,
    playStatusExclude,
    onPlayStatusExcludeChange: setPlayStatusExclude,
    matchAll,
    onMatchAllChange: setMatchAll,
  };

  return {
    searchKeyword,
    setSearchKeyword,
    isSearchActive,
    isPendingDebounce,
    sort,
    setSort,
    ownership: { statuses: ownershipStatuses, exclude: ownershipExclude, matchAll: matchAll.ownership },
    apiFilters,
    fields,
  };
}

export type GameListState = ReturnType<typeof useGameListState>;
