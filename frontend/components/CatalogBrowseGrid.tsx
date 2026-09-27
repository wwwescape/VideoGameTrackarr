import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { CatalogResyncKind, GameCategory, GameSortOption, GameSummary, MediaFormat } from "../api/types";
import { useCollectionAddons, useCollections, useFranchiseAddons, useFranchises } from "../hooks/useCatalogBrowse";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useGames } from "../hooks/useGames";
import { usePlatforms } from "../hooks/usePlatforms";
import { useStorefronts } from "../hooks/useStorefronts";
import { useTags } from "../hooks/useTags";
import { gameIdentifier } from "../utils/identifiers";
import { ALL_KNOWN_STOREFRONTS } from "../utils/storefronts";
import CatalogResyncButton from "./CatalogResyncButton";
import GameCard from "./GameCard";
import GameListToolbar, { type OwnershipStatus } from "./GameListToolbar";
import VirtualGameGrid from "./VirtualGameGrid";
import { usePruneStaleIds, useSessionState } from "../hooks/useSessionState";

const MIN_SEARCH_LENGTH = 3;

function filterByOwnershipAndMissing(
  list: GameSummary[] | undefined,
  ownershipStatuses: OwnershipStatus[],
  ownershipExclude: boolean,
  showMissing: boolean
): GameSummary[] {
  let result = list ?? [];
  if (ownershipStatuses.length > 0) {
    result = result.filter((game) => {
      const matches = ownershipStatuses.some((status) => (status === "owned" ? game.owned : game.wishlisted));
      return ownershipExclude ? !matches : matches;
    });
  }
  if (!showMissing) {
    result = result.filter((game) => game.owned || game.wishlisted);
  }
  return result;
}

interface CatalogBrowseGridProps {
  kindLabel: string;
  name: string | undefined;
  entityId: number | undefined;
  isLoading: boolean;
  resyncKind: CatalogResyncKind;
  slug: string | undefined;
  resyncLabel: string;
}

// A sibling of GameList.tsx — same filter-state shape, same GameListToolbar, reused as-is —
// but scoped to one Collection/Series (via requiredCollectionId/requiredFranchiseId on the
// Games fetch, and the dedicated .../addons endpoints for the Addons section) instead of the
// whole library, and with no bulk-selection support (this page has no bulk actions).
const CatalogBrowseGrid = ({
  kindLabel,
  name,
  entityId,
  isLoading,
  resyncKind,
  slug,
  resyncLabel,
}: CatalogBrowseGridProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isCollection = resyncKind === "collection";
  // Remembered per collection/series for the session, so filters set on one don't carry
  // over to another (see hooks/useSessionState.ts).
  const stateKey = `${isCollection ? "collection" : "series"}.${slug ?? ""}`;

  const [searchKeyword, setSearchKeyword] = useSessionState(`${stateKey}.searchKeyword`, "");
  const [ownershipStatuses, setOwnershipStatuses] = useSessionState<OwnershipStatus[]>(`${stateKey}.ownershipStatuses`, []);
  const [ownershipExclude, setOwnershipExclude] = useSessionState(`${stateKey}.ownershipExclude`, false);
  const [platformIds, setPlatformIds] = useSessionState<number[]>(`${stateKey}.platformIds`, []);
  const [platformExclude, setPlatformExclude] = useSessionState(`${stateKey}.platformExclude`, false);
  const [tagIds, setTagIds] = useSessionState<number[]>(`${stateKey}.tagIds`, []);
  const [tagExclude, setTagExclude] = useSessionState(`${stateKey}.tagExclude`, false);
  const [collectionIds, setCollectionIds] = useSessionState<number[]>(`${stateKey}.collectionIds`, []);
  const [collectionExclude, setCollectionExclude] = useSessionState(`${stateKey}.collectionExclude`, false);
  const [franchiseIds, setFranchiseIds] = useSessionState<number[]>(`${stateKey}.franchiseIds`, []);
  const [franchiseExclude, setFranchiseExclude] = useSessionState(`${stateKey}.franchiseExclude`, false);
  const [gameTypes, setGameTypes] = useSessionState<GameCategory[]>(`${stateKey}.gameTypes`, []);
  const [gameTypeExclude, setGameTypeExclude] = useSessionState(`${stateKey}.gameTypeExclude`, false);
  const [formats, setFormats] = useSessionState<MediaFormat[]>(`${stateKey}.formats`, []);
  const [formatExclude, setFormatExclude] = useSessionState(`${stateKey}.formatExclude`, false);
  const [storefronts, setStorefronts] = useSessionState<string[]>(`${stateKey}.storefronts`, []);
  const [storefrontExclude, setStorefrontExclude] = useSessionState(`${stateKey}.storefrontExclude`, false);
  const [steelbookOnly, setSteelbookOnly] = useSessionState(`${stateKey}.steelbookOnly`, false);
  const [sort, setSort] = useSessionState<GameSortOption>(`${stateKey}.sort`, "name_asc");
  // Off by default (unlike the Games page's default-on) — preserves the pre-existing "only
  // games I've added" view; a Resync (see CatalogResyncButton) is what starts populating
  // games that are neither owned nor wishlisted here at all.
  const [showMissing, setShowMissing] = useSessionState(`${stateKey}.showMissing`, false);
  const [includeAddons, setIncludeAddons] = useSessionState(`${stateKey}.includeAddons`, false);

  const trimmedKeyword = searchKeyword.trim();
  const debouncedKeyword = useDebouncedValue(trimmedKeyword, 500);
  const isSearchActive = debouncedKeyword.length >= MIN_SEARCH_LENGTH;

  const { data: platforms = [], isSuccess: platformsLoaded } = usePlatforms();
  const { data: tags = [], isSuccess: tagsLoaded } = useTags();
  const { data: collections = [], isSuccess: collectionsLoaded } = useCollections();
  const { data: franchises = [], isSuccess: franchisesLoaded } = useFranchises();
  usePruneStaleIds(platformIds, setPlatformIds, platforms, platformsLoaded);
  usePruneStaleIds(tagIds, setTagIds, tags, tagsLoaded);
  usePruneStaleIds(collectionIds, setCollectionIds, collections, collectionsLoaded);
  usePruneStaleIds(franchiseIds, setFranchiseIds, franchises, franchisesLoaded);
  const { data: realStorefronts = [] } = useStorefronts();
  const storefrontOptions = useMemo(
    () => Array.from(new Set([...ALL_KNOWN_STOREFRONTS, ...realStorefronts])).sort(),
    [realStorefronts]
  );

  const sharedFilters = useMemo(
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
      categories: gameTypes.length > 0 ? gameTypes : undefined,
      categoryExclude: gameTypeExclude,
      formats: formats.length > 0 ? formats : undefined,
      formatExclude,
      storefronts: storefronts.length > 0 ? storefronts : undefined,
      storefrontExclude,
      steelbookOnly,
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
      gameTypeExclude,
      formats,
      formatExclude,
      storefronts,
      storefrontExclude,
      steelbookOnly,
      sort,
    ]
  );

  const gamesFilters = useMemo(
    () => ({
      ...sharedFilters,
      requiredCollectionId: isCollection ? entityId : undefined,
      requiredFranchiseId: !isCollection ? entityId : undefined,
    }),
    [sharedFilters, isCollection, entityId]
  );
  const { data: games, isLoading: isGamesLoading } = useGames(gamesFilters, { enabled: !!entityId });

  const { data: collectionAddons, isLoading: isCollectionAddonsLoading } = useCollectionAddons(
    isCollection ? slug : undefined,
    sharedFilters,
    includeAddons && isCollection
  );
  const { data: franchiseAddons, isLoading: isFranchiseAddonsLoading } = useFranchiseAddons(
    !isCollection ? slug : undefined,
    sharedFilters,
    includeAddons && !isCollection
  );
  const addons = isCollection ? collectionAddons : franchiseAddons;
  const isAddonsLoading = isCollection ? isCollectionAddonsLoading : isFranchiseAddonsLoading;

  const visibleGames = useMemo(
    () => filterByOwnershipAndMissing(games, ownershipStatuses, ownershipExclude, showMissing),
    [games, ownershipStatuses, ownershipExclude, showMissing]
  );
  const visibleAddons = useMemo(
    () => filterByOwnershipAndMissing(addons, ownershipStatuses, ownershipExclude, showMissing),
    [addons, ownershipStatuses, ownershipExclude, showMissing]
  );

  const handleGameClick = (game: GameSummary) => navigate(`/game/${gameIdentifier(game)}`);

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            {kindLabel}
          </Typography>
          <Typography variant="h4" component="h1" gutterBottom>
            {name ?? t("common.loading")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("catalog.browseGrid.importedOnlyNotice")}
          </Typography>
        </Box>
        {slug ? <CatalogResyncButton kind={resyncKind} slug={slug} label={resyncLabel} /> : null}
      </Box>
      {entityId ? (
        <Box sx={{ mb: 3 }}>
          <GameListToolbar
            searchKeyword={searchKeyword}
            onSearchKeywordChange={setSearchKeyword}
            ownershipStatuses={ownershipStatuses}
            onOwnershipStatusesChange={setOwnershipStatuses}
            ownershipExclude={ownershipExclude}
            onOwnershipExcludeChange={setOwnershipExclude}
            platformOptions={platforms}
            platformIds={platformIds}
            onPlatformIdsChange={setPlatformIds}
            platformExclude={platformExclude}
            onPlatformExcludeChange={setPlatformExclude}
            tagOptions={tags}
            tagIds={tagIds}
            onTagIdsChange={setTagIds}
            tagExclude={tagExclude}
            onTagExcludeChange={setTagExclude}
            collectionOptions={collections}
            collectionIds={collectionIds}
            onCollectionIdsChange={setCollectionIds}
            collectionExclude={collectionExclude}
            onCollectionExcludeChange={setCollectionExclude}
            hideCollectionsField={isCollection}
            franchiseOptions={franchises}
            franchiseIds={franchiseIds}
            onFranchiseIdsChange={setFranchiseIds}
            franchiseExclude={franchiseExclude}
            onFranchiseExcludeChange={setFranchiseExclude}
            hideFranchisesField={!isCollection}
            gameTypes={gameTypes}
            onGameTypesChange={setGameTypes}
            gameTypeExclude={gameTypeExclude}
            onGameTypeExcludeChange={setGameTypeExclude}
            formats={formats}
            onFormatsChange={setFormats}
            formatExclude={formatExclude}
            onFormatExcludeChange={setFormatExclude}
            storefrontOptions={storefrontOptions}
            storefronts={storefronts}
            onStorefrontsChange={setStorefronts}
            storefrontExclude={storefrontExclude}
            onStorefrontExcludeChange={setStorefrontExclude}
            steelbookOnly={steelbookOnly}
            onSteelbookOnlyChange={setSteelbookOnly}
            sort={sort}
            onSortChange={setSort}
            showMissing={showMissing}
            onShowMissingChange={setShowMissing}
            includeAddons={includeAddons}
            onIncludeAddonsChange={setIncludeAddons}
          />
        </Box>
      ) : null}
      {isLoading || isGamesLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : includeAddons ? (
        <Stack spacing={4}>
          <Box>
            <Typography variant="h6" gutterBottom>
              {t("catalog.browseGrid.gamesSectionTitle")}
            </Typography>
            {visibleGames.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: "center" }}>
                {t("catalog.browseGrid.emptyMessage", { kind: kindLabel.toLowerCase() })}
              </Paper>
            ) : (
              <VirtualGameGrid
                items={visibleGames}
                getKey={(game) => game.id}
                renderItem={(game) => (
                  <GameCard game={game} context="list" contextFunction={() => handleGameClick(game)} />
                )}
              />
            )}
          </Box>
          <Box>
            <Typography variant="h6" gutterBottom>
              {t("catalog.browseGrid.addonsSectionTitle")}
            </Typography>
            {isAddonsLoading ? (
              <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
            ) : visibleAddons.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.listToolbar.noSearchMatches")}</Paper>
            ) : (
              <VirtualGameGrid
                items={visibleAddons}
                getKey={(addon) => addon.id}
                renderItem={(addon) => (
                  <GameCard game={addon} context="addon" contextFunction={() => handleGameClick(addon)} />
                )}
              />
            )}
          </Box>
        </Stack>
      ) : visibleGames.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>
          {t("catalog.browseGrid.emptyMessage", { kind: kindLabel.toLowerCase() })}
        </Paper>
      ) : (
        <VirtualGameGrid
          items={visibleGames}
          getKey={(game) => game.id}
          renderItem={(game) => (
            <GameCard game={game} context="list" contextFunction={() => handleGameClick(game)} />
          )}
        />
      )}
    </>
  );
};

export default CatalogBrowseGrid;
