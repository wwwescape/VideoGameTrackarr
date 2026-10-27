import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MatchAllFilters } from "../api/games";
import type { GameCategory, GameSortOption, GameSource, MediaFormat, PlayStatus, ReleaseStatus } from "../api/types";
import { TIME_TO_BEAT_OPTIONS, type OwnershipStatus, type PlatformFilterOption, type TimeToBeatRange } from "../components/GameFilterDialog";
import { platformDisplayName, platformScopeKey } from "../utils/platformScope";
import { writeSessionValue } from "../utils/sessionViewState";
import { ALL_KNOWN_STOREFRONTS } from "../utils/storefronts";
import { useCollections, useFranchises } from "./useCatalogBrowse";
import { useDebouncedValue } from "./useDebouncedValue";
import { useGenres } from "./useGenres";
import { useLibraryPlatforms } from "./usePlatforms";
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
  platformScopes: [] as string[],
  genreIds: [] as number[],
  genreExclude: false,
  releaseStatuses: [] as ReleaseStatus[],
  releaseYearFrom: null as number | null,
  releaseYearTo: null as number | null,
  localPlayersMin: null as number | null,
  onlineMultiplayerOnly: false,
  coopOnly: false,
  timeToBeat: null as TimeToBeatRange | null,
  ratingMin: null as number | null,
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
  const [platformScopes, setPlatformScopes] = useSessionState<string[]>(key("platformScopes"), []);
  const [genreIds, setGenreIds] = useSessionState<number[]>(key("genreIds"), []);
  const [genreExclude, setGenreExclude] = useSessionState(key("genreExclude"), false);
  const [releaseStatuses, setReleaseStatuses] = useSessionState<ReleaseStatus[]>(key("releaseStatuses"), []);
  const [releaseYearFrom, setReleaseYearFrom] = useSessionState<number | null>(key("releaseYearFrom"), null);
  const [releaseYearTo, setReleaseYearTo] = useSessionState<number | null>(key("releaseYearTo"), null);
  const [localPlayersMin, setLocalPlayersMin] = useSessionState<number | null>(key("localPlayersMin"), null);
  const [onlineMultiplayerOnly, setOnlineMultiplayerOnly] = useSessionState(key("onlineMultiplayerOnly"), false);
  const [coopOnly, setCoopOnly] = useSessionState(key("coopOnly"), false);
  const [timeToBeat, setTimeToBeat] = useSessionState<TimeToBeatRange | null>(key("timeToBeat"), null);
  const [ratingMin, setRatingMin] = useSessionState<number | null>(key("ratingMin"), null);
  const [sort, setSort] = useSessionState<GameSortOption>(key("sort"), "name_asc");
  // The view (saved filters) last put back on this list; it shows as modified once the filters
  // drift from it (see GameListPresets).
  const [activeView, setActiveView] = useSessionState<string | null>(key("activeView"), null);
  // A page without a field ignores whatever was once remembered for it.
  const gameTypesList = useMemo(() => (gameTypes ? gameTypeValues : []), [gameTypes, gameTypeValues]);
  const steelbookOnly = steelbook ? steelbookValue : false;
  const sourcesList = useMemo(() => (sources ? sourceValues : []), [sources, sourceValues]);

  const trimmedKeyword = searchKeyword.trim();
  const debouncedKeyword = useDebouncedValue(trimmedKeyword, 500);
  const isSearchActive = debouncedKeyword.length >= MIN_SEARCH_LENGTH;
  const isPendingDebounce = trimmedKeyword.length >= MIN_SEARCH_LENGTH && trimmedKeyword !== debouncedKeyword;

  const { t } = useTranslation();
  // Only the Platforms-page cards the library actually has — PC split per storefront the same
  // way — rather than every platform IGDB has ever attached to an imported game.
  const { data: libraryPlatforms = [], isSuccess: platformsLoaded } = useLibraryPlatforms();
  const platformOptions = useMemo<PlatformFilterOption[]>(
    () =>
      libraryPlatforms.map((platform) => {
        const scope = { format: platform.format ?? undefined, storefront: platform.storefront ?? undefined };
        return { id: platformScopeKey(platform.id, scope), label: platformDisplayName(platform, scope, t) };
      }),
    [libraryPlatforms, t]
  );
  const platformIdOptions = useMemo(() => libraryPlatforms.map((platform) => ({ id: platform.id })), [libraryPlatforms]);
  // An Insights row or Overview link still presets plain platformIds; the dialog edits both as
  // one list of card keys and writes them back as scopes.
  const platformKeys = useMemo(
    () => [...platformIds.map(String), ...platformScopes],
    [platformIds, platformScopes]
  );
  const setPlatformKeys = useCallback(
    (keys: string[]) => {
      setPlatformIds([]);
      setPlatformScopes(keys);
    },
    [setPlatformIds, setPlatformScopes]
  );
  const { data: genres = [], isSuccess: genresLoaded } = useGenres();
  const { data: tags = [], isSuccess: tagsLoaded } = useTags();
  const { data: collections = [], isSuccess: collectionsLoaded } = useCollections();
  const { data: franchises = [], isSuccess: franchisesLoaded } = useFranchises();
  usePruneStaleIds(platformIds, setPlatformIds, platformIdOptions, platformsLoaded);
  usePruneStaleIds(platformScopes, setPlatformScopes, platformOptions, platformsLoaded);
  usePruneStaleIds(genreIds, setGenreIds, genres, genresLoaded);
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
      platformScopes: platformScopes.length > 0 ? platformScopes : undefined,
      genreIds: genreIds.length > 0 ? genreIds : undefined,
      genreExclude,
      releaseStatuses: releaseStatuses.length > 0 ? releaseStatuses : undefined,
      releaseYearFrom: releaseYearFrom ?? undefined,
      releaseYearTo: releaseYearTo ?? undefined,
      localPlayersMin: localPlayersMin ?? undefined,
      onlineMultiplayerOnly,
      coopOnly,
      timeToBeatMin: TIME_TO_BEAT_OPTIONS.find((option) => option.value === timeToBeat)?.min,
      timeToBeatMax: TIME_TO_BEAT_OPTIONS.find((option) => option.value === timeToBeat)?.max,
      ratingMin: ratingMin ?? undefined,
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
      platformScopes,
      genreIds,
      genreExclude,
      releaseStatuses,
      releaseYearFrom,
      releaseYearTo,
      localPlayersMin,
      onlineMultiplayerOnly,
      coopOnly,
      timeToBeat,
      ratingMin,
      sort,
    ]
  );

  // Everything the Filter dialog (GameFilterDialog) edits.
  const fields = {
    ownershipStatuses,
    onOwnershipStatusesChange: setOwnershipStatuses,
    ownershipExclude,
    onOwnershipExcludeChange: setOwnershipExclude,
    platformOptions,
    platformKeys,
    onPlatformKeysChange: setPlatformKeys,
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
    genreOptions: genres,
    genreIds,
    onGenreIdsChange: setGenreIds,
    genreExclude,
    onGenreExcludeChange: setGenreExclude,
    releaseStatuses,
    onReleaseStatusesChange: setReleaseStatuses,
    releaseYearFrom,
    onReleaseYearFromChange: setReleaseYearFrom,
    releaseYearTo,
    onReleaseYearToChange: setReleaseYearTo,
    localPlayersMin,
    onLocalPlayersMinChange: setLocalPlayersMin,
    onlineMultiplayerOnly,
    onOnlineMultiplayerOnlyChange: setOnlineMultiplayerOnly,
    coopOnly,
    onCoopOnlyChange: setCoopOnly,
    timeToBeat,
    onTimeToBeatChange: setTimeToBeat,
    ratingMin,
    onRatingMinChange: setRatingMin,
  };

  // The filters as they're set now (not the search or sort) — what a saved filter keeps — and
  // putting a saved one back. Names are CLEARED_FILTERS's, so a filter missing from a saved one
  // (saved before it existed) is cleared, and one this version no longer has is ignored.
  const filterSnapshot = {
    ownershipStatuses,
    ownershipExclude,
    platformIds,
    platformExclude,
    tagIds,
    tagExclude,
    collectionIds,
    collectionExclude,
    franchiseIds,
    franchiseExclude,
    gameTypes: gameTypeValues,
    gameTypeExclude,
    formats,
    formatExclude,
    storefronts,
    storefrontExclude,
    playStatuses,
    playStatusExclude,
    matchAll,
    steelbookOnly: steelbookValue,
    sources: sourceValues,
    sourceExclude,
    platformScopes,
    genreIds,
    genreExclude,
    releaseStatuses,
    releaseYearFrom,
    releaseYearTo,
    localPlayersMin,
    onlineMultiplayerOnly,
    coopOnly,
    timeToBeat,
    ratingMin,
  };
  // Whether the filters set now are exactly a saved view's: names it doesn't mention count as
  // cleared, the same way applyFilters reads it.
  const matchesFilters = (saved: Record<string, unknown>) =>
    (Object.keys(filterSnapshot) as (keyof typeof filterSnapshot)[]).every(
      (name) => JSON.stringify(saved[name] ?? CLEARED_FILTERS[name]) === JSON.stringify(filterSnapshot[name])
    );
  const applyFilters = (saved: Record<string, unknown>) => {
    const value = <K extends keyof typeof CLEARED_FILTERS>(name: K) =>
      (saved[name] ?? CLEARED_FILTERS[name]) as (typeof CLEARED_FILTERS)[K];
    setOwnershipStatuses(value("ownershipStatuses"));
    setOwnershipExclude(value("ownershipExclude"));
    setPlatformIds(value("platformIds"));
    setPlatformExclude(value("platformExclude"));
    setTagIds(value("tagIds"));
    setTagExclude(value("tagExclude"));
    setCollectionIds(value("collectionIds"));
    setCollectionExclude(value("collectionExclude"));
    setFranchiseIds(value("franchiseIds"));
    setFranchiseExclude(value("franchiseExclude"));
    setGameTypes(value("gameTypes"));
    setGameTypeExclude(value("gameTypeExclude"));
    setFormats(value("formats"));
    setFormatExclude(value("formatExclude"));
    setStorefronts(value("storefronts"));
    setStorefrontExclude(value("storefrontExclude"));
    setPlayStatuses(value("playStatuses"));
    setPlayStatusExclude(value("playStatusExclude"));
    setMatchAll(value("matchAll"));
    setSteelbookOnly(value("steelbookOnly"));
    setSources(value("sources"));
    setSourceExclude(value("sourceExclude"));
    setPlatformScopes(value("platformScopes"));
    setGenreIds(value("genreIds"));
    setGenreExclude(value("genreExclude"));
    setReleaseStatuses(value("releaseStatuses"));
    setReleaseYearFrom(value("releaseYearFrom"));
    setReleaseYearTo(value("releaseYearTo"));
    setLocalPlayersMin(value("localPlayersMin"));
    setOnlineMultiplayerOnly(value("onlineMultiplayerOnly"));
    setCoopOnly(value("coopOnly"));
    setTimeToBeat(value("timeToBeat"));
    setRatingMin(value("ratingMin"));
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
    filterSnapshot,
    applyFilters,
    matchesFilters,
    activeView,
    setActiveView,
  };
}

export type GameListState = ReturnType<typeof useGameListState>;
