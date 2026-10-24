import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CheckBoxOutlinedIcon from "@mui/icons-material/CheckBoxOutlined";
import ClearIcon from "@mui/icons-material/Clear";
import CloseIcon from "@mui/icons-material/Close";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DeselectIcon from "@mui/icons-material/Deselect";
import EditIcon from "@mui/icons-material/Edit";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import GridViewIcon from "@mui/icons-material/GridView";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SearchIcon from "@mui/icons-material/Search";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import SortIcon from "@mui/icons-material/Sort";
import TableRowsIcon from "@mui/icons-material/TableRows";
import TuneIcon from "@mui/icons-material/Tune";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Slider from "@mui/material/Slider";
import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";
import type { MatchAllFilters } from "../api/games";
import type {
  GameCategory,
  GameSortOption,
  GameSource,
  GameSummary,
  MediaFormat,
  PlayStatus,
} from "../api/types";
import { useCollections, useFranchises } from "../hooks/useCatalogBrowse";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useDeleteGame, useGames } from "../hooks/useGames";
import { useLibraryItems } from "../hooks/useLibrary";
import { useLocalPreference } from "../hooks/useLocalPreference";
import { usePlatforms } from "../hooks/usePlatforms";
import { useStorefronts } from "../hooks/useStorefronts";
import { useTags } from "../hooks/useTags";
import { useUndoableAction } from "../hooks/useUndoableAction";
import { gameIdentifier } from "../utils/identifiers";
import { matchesOwnership } from "../utils/ownershipFilter";
import { GAME_SORT_OPTIONS } from "../utils/gameSortOptions";
import { ALL_KNOWN_STOREFRONTS } from "../utils/storefronts";
import { showUndoToast } from "./UndoToast";
import GameCard, { GameCardHoverAction } from "./GameCard";
import GameFilterDialog, {
  countActiveFilters,
  FORMAT_OPTIONS,
  GAME_TYPE_OPTIONS,
  OWNERSHIP_OPTIONS,
  PLAY_STATUS_OPTIONS,
  platformOptionLabel,
  SOURCE_OPTIONS,
  type OwnershipStatus,
} from "./GameFilterDialog";
import {
  CARD_SIZE_DEFAULT,
  CARD_SIZE_MAX,
  CARD_SIZE_MIN,
  GameCoverGrid,
  GameOverviewRows,
  GameTable,
  type GameListView,
} from "./GameListViews";
import PlayGameDialog from "./PlayGameDialog";
import Page, { ToolbarButton } from "./Page";
import ManageTagsDialog from "./ManageTagsDialog";
import { usePruneStaleIds, useSessionState } from "../hooks/useSessionState";
import { useSearchHandoff } from "../navigation/GlobalSearch";

const MIN_SEARCH_LENGTH = 3;

const GameList = () => {
  const { t } = useTranslation();
  const [searchKeyword, setSearchKeyword] = useSessionState("games.searchKeyword", "");
  // Enter in the header search lands here with its text.
  useSearchHandoff("search", setSearchKeyword);
  const [ownershipStatuses, setOwnershipStatuses] = useSessionState<OwnershipStatus[]>("games.ownershipStatuses", []);
  const [ownershipExclude, setOwnershipExclude] = useSessionState("games.ownershipExclude", false);
  const [platformIds, setPlatformIds] = useSessionState<number[]>("games.platformIds", []);
  const [platformExclude, setPlatformExclude] = useSessionState("games.platformExclude", false);
  const [tagIds, setTagIds] = useSessionState<number[]>("games.tagIds", []);
  const [tagExclude, setTagExclude] = useSessionState("games.tagExclude", false);
  const [collectionIds, setCollectionIds] = useSessionState<number[]>("games.collectionIds", []);
  const [collectionExclude, setCollectionExclude] = useSessionState("games.collectionExclude", false);
  const [franchiseIds, setFranchiseIds] = useSessionState<number[]>("games.franchiseIds", []);
  const [franchiseExclude, setFranchiseExclude] = useSessionState("games.franchiseExclude", false);
  const [gameTypes, setGameTypes] = useSessionState<GameCategory[]>("games.gameTypes", []);
  const [gameTypeExclude, setGameTypeExclude] = useSessionState("games.gameTypeExclude", false);
  const [formats, setFormats] = useSessionState<MediaFormat[]>("games.formats", []);
  const [formatExclude, setFormatExclude] = useSessionState("games.formatExclude", false);
  const [storefronts, setStorefronts] = useSessionState<string[]>("games.storefronts", []);
  const [storefrontExclude, setStorefrontExclude] = useSessionState("games.storefrontExclude", false);
  const [playStatuses, setPlayStatuses] = useSessionState<PlayStatus[]>("games.playStatuses", []);
  const [playStatusExclude, setPlayStatusExclude] = useSessionState("games.playStatusExclude", false);
  const [matchAll, setMatchAll] = useSessionState<MatchAllFilters>("games.matchAll", {});
  const [steelbookOnly, setSteelbookOnly] = useSessionState("games.steelbookOnly", false);
  const [sources, setSources] = useSessionState<GameSource[]>("games.sources", []);
  const [sourceExclude, setSourceExclude] = useSessionState("games.sourceExclude", false);
  const [sort, setSort] = useSessionState<GameSortOption>("games.sort", "name_asc");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set());
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menu, setMenu] = useState<{ name: "options" | "view" | "sort"; anchor: HTMLElement } | null>(null);
  const [playGame, setPlayGame] = useState<GameSummary | null>(null);
  // Display preferences, kept in this browser across visits (not just the session).
  const [view, setView] = useLocalPreference<GameListView>("games.view", "covers");
  const [cardSize, setCardSize] = useLocalPreference("games.cardSize", CARD_SIZE_DEFAULT);
  const navigate = useNavigate();

  const trimmedKeyword = searchKeyword.trim();
  const debouncedKeyword = useDebouncedValue(trimmedKeyword, 500);
  const isSearchActive = debouncedKeyword.length >= MIN_SEARCH_LENGTH;
  const isPendingDebounce =
    trimmedKeyword.length >= MIN_SEARCH_LENGTH && trimmedKeyword !== debouncedKeyword;

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
      playStatuses: playStatuses.length > 0 ? playStatuses : undefined,
      playStatusExclude,
      matchAll,
      steelbookOnly,
      sources: sources.length > 0 ? sources : undefined,
      sourceExclude,
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
      playStatuses,
      playStatusExclude,
      matchAll,
      steelbookOnly,
      sources,
      sourceExclude,
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
      list = list.filter((game) =>
        matchesOwnership(game, ownershipStatuses, ownershipExclude, matchAll.ownership)
      );
    }
    return list;
  }, [games, ownershipStatuses, ownershipExclude, matchAll.ownership]);

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

  // True once every currently-visible game is selected — drives both the toggle's next
  // action and its "active" visual state (see GameListToolbar.tsx). false (not true) when
  // there's nothing visible to select, so an empty list never shows the button as active.
  const allVisibleSelected =
    visibleGames.length > 0 && visibleGames.every((game) => selectedIds.has(game.id));

  const handleToggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleGames.map((game) => game.id)));
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

  // Remove-one-value handlers for the filter chips under the breadcrumbs. An Exclude flag on a
  // field shows on its chips ("Not PS5") and is reset once the field's last value goes.
  const activeFilterCount = countActiveFilters({
    ownershipStatuses,
    platformIds,
    tagIds,
    collectionIds,
    franchiseIds,
    gameTypes,
    formats,
    storefronts,
    playStatuses,
    sources,
    steelbookOnly,
  });

  const filterChips: { key: string; label: string; onRemove: () => void }[] = [];
  const addChips = <V,>(
    field: string,
    values: V[],
    exclude: boolean,
    labelOf: (value: V) => string | undefined,
    setValues: (next: V[]) => void,
    setExclude?: (next: boolean) => void
  ) => {
    values.forEach((value) => {
      const label = labelOf(value) ?? String(value);
      filterChips.push({
        key: `${field}-${String(value)}`,
        label: exclude ? t("games.listView.excludedChip", { label }) : label,
        onRemove: () => {
          const next = values.filter((other) => other !== value);
          setValues(next);
          if (next.length === 0) setExclude?.(false);
        },
      });
    });
  };
  addChips("ownership", ownershipStatuses, ownershipExclude, (value) => t(OWNERSHIP_OPTIONS.find((o) => o.value === value)?.labelKey ?? ""), setOwnershipStatuses, setOwnershipExclude);
  addChips("playStatus", playStatuses, playStatusExclude, (value) => t(PLAY_STATUS_OPTIONS.find((o) => o.value === value)?.labelKey ?? ""), setPlayStatuses, setPlayStatusExclude);
  addChips("platform", platformIds, platformExclude, (id) => platforms.find((p) => p.id === id) && platformOptionLabel(platforms.find((p) => p.id === id)!), setPlatformIds, setPlatformExclude);
  addChips("tag", tagIds, tagExclude, (id) => tags.find((tag) => tag.id === id)?.name, setTagIds, setTagExclude);
  addChips("collection", collectionIds, collectionExclude, (id) => collections.find((c) => c.id === id)?.name, setCollectionIds, setCollectionExclude);
  addChips("series", franchiseIds, franchiseExclude, (id) => franchises.find((f) => f.id === id)?.name, setFranchiseIds, setFranchiseExclude);
  addChips("type", gameTypes, gameTypeExclude, (value) => GAME_TYPE_OPTIONS.find((o) => o.value === value)?.label, setGameTypes, setGameTypeExclude);
  addChips("format", formats, formatExclude, (value) => FORMAT_OPTIONS.find((o) => o.value === value)?.label, setFormats, setFormatExclude);
  addChips("storefront", storefronts, storefrontExclude, (value) => value, setStorefronts, setStorefrontExclude);
  addChips("source", sources, sourceExclude, (value) => t(SOURCE_OPTIONS.find((o) => o.value === value)?.labelKey ?? ""), setSources, setSourceExclude);
  if (steelbookOnly) {
    filterChips.push({ key: "steelbook", label: t("games.listToolbar.steelbookOnlyLabel"), onRemove: () => setSteelbookOnly(false) });
  }

  const filterFields = {
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
    gameTypes,
    onGameTypesChange: setGameTypes,
    gameTypeExclude,
    onGameTypeExcludeChange: setGameTypeExclude,
    formats,
    onFormatsChange: setFormats,
    formatExclude,
    onFormatExcludeChange: setFormatExclude,
    storefrontOptions,
    storefronts,
    onStorefrontsChange: setStorefronts,
    storefrontExclude,
    onStorefrontExcludeChange: setStorefrontExclude,
    steelbookOnly,
    onSteelbookOnlyChange: setSteelbookOnly,
    sources,
    onSourcesChange: setSources,
    sourceExclude,
    onSourceExcludeChange: setSourceExclude,
    playStatuses,
    onPlayStatusesChange: setPlayStatuses,
    playStatusExclude,
    onPlayStatusExcludeChange: setPlayStatusExclude,
    matchAll,
    onMatchAllChange: setMatchAll,
    sort,
    onSortChange: setSort,
  };

  const hoverActionsFor = (game: GameSummary) => {
    const actions = [];
    // Same conditions as the game page's own buttons: Edit is for custom games (IGDB games
    // are resynced, not edited), Play needs an owned copy with a ROM the emulator can run.
    if (game.igdbId === null) {
      actions.push(
        <GameCardHoverAction
          key="edit"
          icon={<EditIcon />}
          label={t("games.listView.edit")}
          onClick={() => navigate(`/game/${gameIdentifier(game)}/edit`)}
        />
      );
    }
    if (game.playable) {
      actions.push(
        <GameCardHoverAction key="play" icon={<PlayArrowIcon />} label={t("games.listView.play")} onClick={() => setPlayGame(game)} />
      );
    }
    return actions.length ? actions : undefined;
  };

  const viewIcons: Record<GameListView, ReactNode> = {
    covers: <GridViewIcon />,
    table: <TableRowsIcon />,
    overview: <ViewAgendaIcon />,
  };

  const normalToolbar = (
    <>
      <ToolbarButton primary icon={<AddIcon />} label={t("games.list.addGameButton")} onClick={() => navigate("/games/add")} />
      <ToolbarButton
        icon={<CheckBoxOutlinedIcon />}
        label={t("games.listView.select")}
        onClick={handleEnterSelectionMode}
        disabled={visibleGames.length === 0}
      />
    </>
  );
  const normalToolbarEnd = (
    <>
      <ToolbarButton
        icon={<TuneIcon />}
        label={t("games.listView.options")}
        onClick={(event) => setMenu({ name: "options", anchor: event.currentTarget })}
        aria-haspopup="menu"
      />
      <ToolbarButton
        icon={viewIcons[view]}
        label={t("games.listView.view")}
        onClick={(event) => setMenu({ name: "view", anchor: event.currentTarget })}
        aria-haspopup="menu"
      />
      <ToolbarButton
        icon={<SortIcon />}
        label={t("games.listView.sort")}
        onClick={(event) => setMenu({ name: "sort", anchor: event.currentTarget })}
        aria-haspopup="menu"
      />
      <ToolbarButton
        icon={<FilterAltOutlinedIcon />}
        label={t("games.listView.filter")}
        count={activeFilterCount}
        active={activeFilterCount > 0}
        onClick={() => setFiltersOpen(true)}
      />
    </>
  );
  const selectionToolbar = (
    <>
      <ToolbarButton icon={<CloseIcon />} label={t("games.listView.done")} onClick={handleExitSelectionMode} />
      <Box component="span" sx={{ px: 1, fontWeight: 600, color: "text.secondary", whiteSpace: "nowrap" }}>
        {t("games.listToolbar.selectedCount", { count: selectedIds.size })}
      </Box>
      <ToolbarButton
        icon={allVisibleSelected ? <DeselectIcon /> : <SelectAllIcon />}
        label={allVisibleSelected ? t("games.listToolbar.deselectAllTooltip") : t("games.listToolbar.selectAllTooltip")}
        onClick={handleToggleSelectAll}
        disabled={visibleGames.length === 0}
      />
    </>
  );
  const selectionToolbarEnd = (
    <>
      <ToolbarButton
        icon={<LabelOutlinedIcon />}
        label={t("games.listToolbar.manageTagsButton")}
        onClick={() => setManageTagsOpen(true)}
        disabled={selectedIds.size === 0}
      />
      <ToolbarButton
        danger
        icon={<DeleteOutlineIcon />}
        label={t("common.remove")}
        onClick={handleBulkDelete}
        disabled={selectedIds.size === 0}
      />
    </>
  );

  const menuItem = (key: string, label: ReactNode, selected: boolean, onSelect: () => void, icon?: ReactNode) => (
    <MenuItem
      key={key}
      selected={selected}
      onClick={() => {
        onSelect();
        setMenu(null);
      }}
    >
      {icon ? <ListItemIcon>{icon}</ListItemIcon> : null}
      <ListItemText>{label}</ListItemText>
      {selected ? <CheckIcon fontSize="small" color="primary" sx={{ ml: 2 }} /> : null}
    </MenuItem>
  );

  const hasActiveFilters = activeFilterCount > 0;
  const emptyMessage = isSearchActive
    ? t("games.list.noGamesFound")
    : hasActiveFilters
      ? t("games.list.noGamesMatchFilter")
      : t("games.list.pleaseAddGames");

  return (
    <Page
      meta={games ? t("games.listView.gameCount", { count: visibleGames.length }) : undefined}
      toolbar={selectionMode ? selectionToolbar : normalToolbar}
      toolbarEnd={selectionMode ? selectionToolbarEnd : normalToolbarEnd}
      actions={
        <TextField
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          placeholder={t("games.listToolbar.searchPlaceholder")}
          sx={{ width: { xs: "100%", sm: 280 } }}
          slotProps={{
            htmlInput: { "aria-label": t("games.listToolbar.searchLabel") },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: "vgt.text3" }} />
                </InputAdornment>
              ),
              endAdornment: searchKeyword ? (
                <InputAdornment position="end">
                  <IconButton size="small" edge="end" onClick={() => setSearchKeyword("")} aria-label={t("games.listView.clearSearch")}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />
      }
    >
      {filterChips.length ? (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: -0.5, mb: 1.75 }}>
          {filterChips.map((chip) => (
            <Chip
              key={chip.key}
              size="small"
              label={chip.label}
              onDelete={chip.onRemove}
              deleteIcon={<CancelIcon aria-label={t("games.listView.removeFilter", { label: chip.label })} />}
            />
          ))}
        </Box>
      ) : null}

      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : isSearching ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.list.searching")}</Paper>
      ) : visibleGames.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{emptyMessage}</Paper>
      ) : view === "table" ? (
        <GameTable
          games={visibleGames}
          onOpen={handleGameClick}
          selecting={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelected}
        />
      ) : view === "overview" ? (
        <GameOverviewRows
          games={visibleGames}
          onOpen={handleGameClick}
          selecting={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelected}
        />
      ) : (
        <GameCoverGrid
          games={visibleGames}
          cardSize={cardSize}
          showRail={sort === "name_asc"}
          renderCard={(game) => (
            <GameCard
              game={game}
              context="list"
              contextFunction={() => handleGameClick(game)}
              selectable={selectionMode}
              selected={selectedIds.has(game.id)}
              onToggleSelect={() => toggleSelected(game.id)}
              hoverActions={hoverActionsFor(game)}
            />
          )}
        />
      )}

      <Menu anchorEl={menu?.anchor} open={menu?.name === "options"} onClose={() => setMenu(null)}>
        <Box sx={{ px: 2, pt: 1, pb: 1.5, width: 260 }}>
          <Box id="card-size-label" sx={{ typography: "overline", color: "vgt.text3" }}>
            {t("games.listView.cardSize")}
          </Box>
          <Slider
            value={cardSize}
            min={CARD_SIZE_MIN}
            max={CARD_SIZE_MAX}
            step={10}
            onChange={(_event, value) => setCardSize(value as number)}
            aria-labelledby="card-size-label"
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value}px`}
            disabled={view !== "covers"}
          />
        </Box>
      </Menu>
      <Menu anchorEl={menu?.anchor} open={menu?.name === "view"} onClose={() => setMenu(null)}>
        {(["covers", "table", "overview"] as GameListView[]).map((option) =>
          menuItem(option, t(`games.listView.view_${option}`), view === option, () => setView(option), viewIcons[option])
        )}
      </Menu>
      <Menu anchorEl={menu?.anchor} open={menu?.name === "sort"} onClose={() => setMenu(null)}>
        {GAME_SORT_OPTIONS.map((option) =>
          menuItem(option.value, t(option.labelKey), sort === option.value, () => setSort(option.value))
        )}
      </Menu>

      <GameFilterDialog {...filterFields} open={filtersOpen} onClose={() => setFiltersOpen(false)} hideMoreTab />
      <ManageTagsDialog
        open={manageTagsOpen}
        gameIds={Array.from(selectedIds)}
        onClose={() => setManageTagsOpen(false)}
      />
      {playGame ? <QuickPlay game={playGame} onClose={() => setPlayGame(null)} /> : null}
    </Page>
  );
};

// The hover Play shortcut opens the game page's own Play dialog; that needs the game's
// library copies (and their ROMs), fetched only when asked for.
const QuickPlay = ({ game, onClose }: { game: GameSummary; onClose: () => void }) => {
  const { data: libraryItems } = useLibraryItems(game.id);
  if (!libraryItems) return null;
  return <PlayGameDialog open gameName={game.name} libraryItems={libraryItems} onClose={onClose} />;
};

export default GameList;
