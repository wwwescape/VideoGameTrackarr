import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { GameCategory, GameSortOption, GameSummary, MediaFormat } from "../api/types";
import { useCollections, useFranchises } from "../hooks/useCatalogBrowse";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useDeleteGame, useGames } from "../hooks/useGames";
import { usePlatforms } from "../hooks/usePlatforms";
import { useStorefronts } from "../hooks/useStorefronts";
import { useTags } from "../hooks/useTags";
import { useUndoableAction } from "../hooks/useUndoableAction";
import { gameIdentifier } from "../utils/identifiers";
import { ALL_KNOWN_STOREFRONTS } from "../utils/storefronts";
import { showUndoToast } from "./UndoToast";
import GameCard from "./GameCard";
import GameListToolbar, { type OwnershipStatus } from "./GameListToolbar";
import GamesSubNav from "./GamesSubNav";
import VirtualGameGrid from "./VirtualGameGrid";

const MIN_SEARCH_LENGTH = 3;

const GameList = () => {
  const { t } = useTranslation();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [ownershipStatuses, setOwnershipStatuses] = useState<OwnershipStatus[]>([]);
  const [ownershipExclude, setOwnershipExclude] = useState(false);
  const [platformIds, setPlatformIds] = useState<number[]>([]);
  const [platformExclude, setPlatformExclude] = useState(false);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [tagExclude, setTagExclude] = useState(false);
  const [collectionIds, setCollectionIds] = useState<number[]>([]);
  const [collectionExclude, setCollectionExclude] = useState(false);
  const [franchiseIds, setFranchiseIds] = useState<number[]>([]);
  const [franchiseExclude, setFranchiseExclude] = useState(false);
  const [gameTypes, setGameTypes] = useState<GameCategory[]>([]);
  const [gameTypeExclude, setGameTypeExclude] = useState(false);
  const [formats, setFormats] = useState<MediaFormat[]>([]);
  const [formatExclude, setFormatExclude] = useState(false);
  const [storefronts, setStorefronts] = useState<string[]>([]);
  const [storefrontExclude, setStorefrontExclude] = useState(false);
  const [sort, setSort] = useState<GameSortOption>("name_asc");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set());
  const navigate = useNavigate();

  const trimmedKeyword = searchKeyword.trim();
  const debouncedKeyword = useDebouncedValue(trimmedKeyword, 500);
  const isSearchActive = debouncedKeyword.length >= MIN_SEARCH_LENGTH;
  const isPendingDebounce =
    trimmedKeyword.length >= MIN_SEARCH_LENGTH && trimmedKeyword !== debouncedKeyword;

  const { data: platforms = [] } = usePlatforms();
  const { data: tags = [] } = useTags();
  const { data: collections = [] } = useCollections();
  const { data: franchises = [] } = useFranchises();
  const { data: realStorefronts = [] } = useStorefronts();
  // Always offer every storefront the app knows about (Steam/GOG/PlayStation Store/etc.),
  // not just whatever already happens to exist in the data — otherwise a brand-new instance
  // (or one that's simply never added a PSN/Xbox/etc. digital copy yet) would have nothing
  // to pick from for those storefronts at all.
  const storefrontOptions = useMemo(
    () => Array.from(new Set([...ALL_KNOWN_STOREFRONTS, ...realStorefronts])).sort(),
    [realStorefronts]
  );

  const gameListFilters = useMemo(
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
      sort,
    ]
  );
  const { data: games, isLoading, isFetching } = useGames(gameListFilters);
  const isSearching = isPendingDebounce || (isSearchActive && isFetching);

  const deleteGameMutation = useDeleteGame();
  const { schedule, isPending, delayMs } = useUndoableAction<GameSummary>({
    getId: (game) => game.id,
    onCommit: async (gamesToRemove) => {
      await Promise.all(gamesToRemove.map((game) => deleteGameMutation.mutateAsync(game.id)));
    },
  });

  const filteredGames = useMemo(() => {
    if (!games) return [];
    // The Games list never shows a Collection/Series "what's missing" discovery that hasn't
    // been claimed yet — unconditionally, with no toggle to reveal it (unlike the Collection/
    // Series detail pages, where that's the whole point). A manually-added game that just
    // isn't owned/wishlisted yet is unaffected — it stays visible (greyscaled, no chip; see
    // GameCard.tsx) since it was never "missing" in that sense.
    let list = games.filter((game) => !(game.autoDiscovered && !game.owned && !game.wishlisted));
    if (ownershipStatuses.length > 0) {
      list = list.filter((game) => {
        const matches = ownershipStatuses.some((status) =>
          status === "owned" ? game.owned : game.wishlisted
        );
        return ownershipExclude ? !matches : matches;
      });
    }
    return list;
  }, [games, ownershipStatuses, ownershipExclude]);

  const visibleGames = useMemo(
    () => filteredGames.filter((game) => !isPending(game.id)),
    [filteredGames, isPending]
  );

  const handleGameClick = (game: GameSummary) => {
    navigate(`/game/${gameIdentifier(game)}`);
  };

  const toggleSelected = (gameId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedIds(new Set());
  };

  const handleExitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleSelectAllVisible = () => {
    setSelectedIds(new Set(visibleGames.map((game) => game.id)));
  };

  const handleBulkDelete = () => {
    const itemsToRemove = visibleGames.filter((game) => selectedIds.has(game.id));
    if (itemsToRemove.length === 0) {
      return;
    }
    const { undo } = schedule(itemsToRemove);
    setSelectionMode(false);
    setSelectedIds(new Set());
    showUndoToast(
      t("games.list.gamesRemovedToast", { count: itemsToRemove.length }),
      undo,
      delayMs
    );
  };

  return (
    <>
      <Box
        sx={{
          position: "sticky",
          top: (theme) => theme.mixins.toolbar.minHeight,
          zIndex: 1,
          bgcolor: "background.default",
          pb: 2.5,
          // Once scrolled content locks under this sticky header, the bottom edge needs to
          // read as an intentional floating panel rather than content abruptly disappearing.
          boxShadow: "0 4px 8px -4px rgba(0, 0, 0, 0.2)",
        }}
      >
        <GamesSubNav />
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 2,
            mb: 3,
          }}
        >
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {t("games.list.pageTitle")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("games.list.pageSubtitle")}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate("/games/add")}
            sx={{ flexShrink: 0 }}
          >
            {t("games.list.addGameButton")}
          </Button>
        </Box>
        <GameListToolbar
          searchKeyword={searchKeyword}
          onSearchKeywordChange={setSearchKeyword}
          ownershipStatuses={ownershipStatuses}
          onOwnershipStatusesChange={setOwnershipStatuses}
          ownershipExclude={ownershipExclude}
          onOwnershipExcludeChange={setOwnershipExclude}
          selectionMode={selectionMode}
          selectedCount={selectedIds.size}
          visibleCount={visibleGames.length}
          onEnterSelectionMode={handleEnterSelectionMode}
          onExitSelectionMode={handleExitSelectionMode}
          onSelectAllVisible={handleSelectAllVisible}
          onBulkDelete={handleBulkDelete}
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
          franchiseOptions={franchises}
          franchiseIds={franchiseIds}
          onFranchiseIdsChange={setFranchiseIds}
          franchiseExclude={franchiseExclude}
          onFranchiseExcludeChange={setFranchiseExclude}
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
          sort={sort}
          onSortChange={setSort}
        />
      </Box>
      {/* Contains z-index in here to its own stacking context — otherwise MUI's
          shrunk-label z-index (1, same as the sticky header above) ties with the sticky
          box's and falls back to DOM order, letting a floating label paint on top of the
          sticky header instead of staying hidden behind it. */}
      <Box sx={{ isolation: "isolate" }}>
        {isLoading ? (
          <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
        ) : isSearching ? (
          <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.list.searching")}</Paper>
        ) : visibleGames.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: "center" }}>
            {isSearchActive
              ? t("games.list.noGamesFound")
              : ownershipStatuses.length > 0 ||
                  platformIds.length > 0 ||
                  tagIds.length > 0 ||
                  collectionIds.length > 0 ||
                  franchiseIds.length > 0 ||
                  gameTypes.length > 0 ||
                  formats.length > 0 ||
                  storefronts.length > 0
                ? t("games.list.noGamesMatchFilter")
                : t("games.list.pleaseAddGames")}
          </Paper>
        ) : (
          <VirtualGameGrid
            items={visibleGames}
            getKey={(game) => game.id}
            renderItem={(game) => (
              <GameCard
                game={game}
                context="list"
                contextFunction={() => handleGameClick(game)}
                selectable={selectionMode}
                selected={selectedIds.has(game.id)}
                onToggleSelect={() => toggleSelected(game.id)}
              />
            )}
          />
        )}
      </Box>
    </>
  );
};

export default GameList;
