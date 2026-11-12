import { useState, type ReactNode } from "react";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import CancelIcon from "@mui/icons-material/Cancel";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import GridViewIcon from "@mui/icons-material/GridView";
import SortIcon from "@mui/icons-material/Sort";
import TableRowsIcon from "@mui/icons-material/TableRows";
import TuneIcon from "@mui/icons-material/Tune";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import { useTranslation } from "react-i18next";
import { useGameFilterPreferences } from "../hooks/useGameFilterPreferences";
import { useEnabledLabs } from "../hooks/useLabs";
import type { GameListState, PresetField } from "../hooks/useGameListState";
import {
  GAME_SORT_FIELDS,
  gameSortDirection,
  gameSortField,
  makeGameSort,
  pickGameSortField,
  type GameSortField,
} from "../utils/gameSortOptions";
import GameFilterDialog, {
  countActiveFilters,
  FORMAT_OPTIONS,
  GAME_TYPE_OPTIONS,
  OWNERSHIP_OPTIONS,
  PLAY_STATUS_OPTIONS,
  RELEASE_STATUS_OPTIONS,
  SOURCE_OPTIONS,
  TIME_TO_BEAT_OPTIONS,
  timeToBeatLabel,
} from "./GameFilterDialog";
import { useGameListPresets } from "./GameListPresets";
import type { GameListView } from "./GameListViews";
import { CardSizeSlider, ChoiceMenuItem, ListSearchField, SortMenu } from "./ListControls";
import { ToolbarButton } from "./Page";

// A page's own on/off option in the Options menu ("Show what I'm missing", "Include add-ons").
export interface ListToggle {
  key: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

interface GameListControlsOptions {
  // Optional for a page with no View menu and its own Options (the Game Shelf).
  view?: GameListView;
  setView?: (view: GameListView) => void;
  cardSize?: number;
  setCardSize?: (size: number) => void;
  // Pages already scoped to one platform/collection/series hide that filter field.
  hidePlatformsField?: boolean;
  hideCollectionsField?: boolean;
  hideFranchisesField?: boolean;
  // The Game Shelf, where everything is an owned copy.
  hideOwnershipField?: boolean;
  // The Game Shelf, where everything is physical: no Format (or Storefront) field.
  hideFormatsField?: boolean;
  toggles?: ListToggle[];
  // The Options menu's own controls, in place of the Card size slider (the Game Shelf's
  // Shelf scale).
  options?: ReactNode;
  // Off for a list that only has one way to show it (Missing Add-ons's grouped cards).
  showViewMenu?: boolean;
  // What the Sort menu offers, when not every field fits the page.
  sortFields?: GameSortField[];
}

const VIEW_ICONS: Record<GameListView, ReactNode> = {
  covers: <GridViewIcon />,
  table: <TableRowsIcon />,
  overview: <ViewAgendaIcon />,
};

// The game-list controls shared by the Games page, the Series/Collection/Platform pages and
// Missing Add-ons: the toolbar's right-hand group (Options, View, Sort, Filter), the search
// field beside the breadcrumbs, the active-filter chips and the Filter dialog. Each comes back
// as a node for the page to place.
export function useGameListControls(
  state: GameListState,
  {
    view = "covers",
    setView = () => undefined,
    cardSize = 0,
    setCardSize = () => undefined,
    hidePlatformsField,
    hideCollectionsField,
    hideFranchisesField,
    hideOwnershipField,
    hideFormatsField,
    toggles = [],
    options,
    showViewMenu = true,
    sortFields,
  }: GameListControlsOptions
) {
  const { t } = useTranslation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menu, setMenu] = useState<{ name: "options" | "view" | "sort"; anchor: HTMLElement } | null>(null);
  const { fields } = state;
  const filterPreferences = useGameFilterPreferences();
  const presetsLab = useEnabledLabs().has("filter_presets");
  // The fields this page fixes itself, which presets leave alone here.
  const fixedFields: PresetField[] = [
    ...(hidePlatformsField ? (["platform"] as const) : []),
    ...(hideCollectionsField ? (["collection"] as const) : []),
    ...(hideFranchisesField ? (["series"] as const) : []),
    ...(hideOwnershipField ? (["ownership"] as const) : []),
    ...(hideFormatsField ? (["format"] as const) : []),
  ];

  const activeFilterCount = countActiveFilters({
    ownershipStatuses: hideOwnershipField ? [] : fields.ownershipStatuses,
    platformKeys: hidePlatformsField ? [] : fields.platformKeys,
    tagIds: fields.tagIds,
    collectionIds: hideCollectionsField ? [] : fields.collectionIds,
    franchiseIds: hideFranchisesField ? [] : fields.franchiseIds,
    gameTypes: fields.gameTypes,
    formats: hideFormatsField ? [] : fields.formats,
    storefronts: hideFormatsField ? [] : fields.storefronts,
    playStatuses: fields.playStatuses,
    sources: fields.sources,
    steelbookOnly: fields.steelbookOnly,
    screensaverFilter: fields.screensaverFilter,
    includeAddons: fields.includeAddons,
    genreIds: fields.genreIds,
    releaseStatuses: fields.releaseStatuses,
    releaseYearFrom: fields.releaseYearFrom,
    releaseYearTo: fields.releaseYearTo,
    localPlayersMin: fields.localPlayersMin,
    onlineMultiplayerOnly: fields.onlineMultiplayerOnly,
    coopOnly: fields.coopOnly,
    timeToBeat: fields.timeToBeat,
    ratingMin: fields.ratingMin,
  });

  const presets = useGameListPresets(state, {
    enabled: presetsLab,
    canSave: activeFilterCount > 0,
    fixedFields,
  });

  // Remove-one-value chips under the breadcrumbs. An Exclude flag on a field shows on its chips
  // ("Not PS5") and is reset once the field's last value goes.
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  const addChips = <V,>(
    field: string,
    values: V[],
    exclude: boolean | undefined,
    labelOf: (value: V) => string | undefined,
    setValues: (next: V[]) => void,
    setExclude?: (next: boolean) => void
  ) => {
    values.forEach((value) => {
      const label = labelOf(value) ?? String(value);
      chips.push({
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
  if (!hideOwnershipField) addChips("ownership", fields.ownershipStatuses, fields.ownershipExclude, (value) => t(OWNERSHIP_OPTIONS.find((o) => o.value === value)?.labelKey ?? ""), fields.onOwnershipStatusesChange, fields.onOwnershipExcludeChange);
  addChips("playStatus", fields.playStatuses, fields.playStatusExclude, (value) => t(PLAY_STATUS_OPTIONS.find((o) => o.value === value)?.labelKey ?? ""), fields.onPlayStatusesChange, fields.onPlayStatusExcludeChange);
  if (!hidePlatformsField) {
    addChips("platform", fields.platformKeys, fields.platformExclude, (key) => fields.platformOptions.find((p) => p.id === key)?.label, fields.onPlatformKeysChange, fields.onPlatformExcludeChange);
  }
  addChips("tag", fields.tagIds, fields.tagExclude, (id) => fields.tagOptions.find((tag) => tag.id === id)?.name, fields.onTagIdsChange, fields.onTagExcludeChange);
  if (!hideCollectionsField) {
    addChips("collection", fields.collectionIds, fields.collectionExclude, (id) => fields.collectionOptions.find((c) => c.id === id)?.name, fields.onCollectionIdsChange, fields.onCollectionExcludeChange);
  }
  if (!hideFranchisesField) {
    addChips("series", fields.franchiseIds, fields.franchiseExclude, (id) => fields.franchiseOptions.find((f) => f.id === id)?.name, fields.onFranchiseIdsChange, fields.onFranchiseExcludeChange);
  }
  addChips("type", fields.gameTypes, fields.gameTypeExclude, (value) => GAME_TYPE_OPTIONS.find((o) => o.value === value)?.label, fields.onGameTypesChange, fields.onGameTypeExcludeChange);
  if (!hideFormatsField) addChips("format", fields.formats, fields.formatExclude, (value) => FORMAT_OPTIONS.find((o) => o.value === value)?.label, fields.onFormatsChange, fields.onFormatExcludeChange);
  if (!hideFormatsField) addChips("storefront", fields.storefronts, fields.storefrontExclude, (value) => value, fields.onStorefrontsChange, fields.onStorefrontExcludeChange);
  if (fields.sources && fields.onSourcesChange) {
    addChips("source", fields.sources, fields.sourceExclude, (value) => t(SOURCE_OPTIONS.find((o) => o.value === value)?.labelKey ?? ""), fields.onSourcesChange, fields.onSourceExcludeChange);
  }
  addChips("genre", fields.genreIds, fields.genreExclude, (id) => fields.genreOptions.find((genre) => genre.id === id)?.name, fields.onGenreIdsChange, fields.onGenreExcludeChange);
  addChips("release", fields.releaseStatuses, false, (value) => t(RELEASE_STATUS_OPTIONS.find((o) => o.value === value)?.labelKey ?? ""), fields.onReleaseStatusesChange);
  // Single-value fields: one chip each, cleared back to "not filtering".
  const addSingleChip = (key: string, show: boolean, label: string, clear: () => void) => {
    if (show) chips.push({ key, label, onRemove: clear });
  };
  addSingleChip("releaseYearFrom", fields.releaseYearFrom !== null, t("games.listToolbar.releaseYearFromChip", { year: fields.releaseYearFrom }), () => fields.onReleaseYearFromChange(null));
  addSingleChip("releaseYearTo", fields.releaseYearTo !== null, t("games.listToolbar.releaseYearToChip", { year: fields.releaseYearTo }), () => fields.onReleaseYearToChange(null));
  addSingleChip("localPlayers", fields.localPlayersMin !== null, t("games.listToolbar.localPlayersOption", { count: fields.localPlayersMin ?? 0 }), () => fields.onLocalPlayersMinChange(null));
  addSingleChip("online", fields.onlineMultiplayerOnly, t("games.listToolbar.onlineMultiplayerOnlyLabel"), () => fields.onOnlineMultiplayerOnlyChange(false));
  addSingleChip("coop", fields.coopOnly, t("games.listToolbar.coopOnlyLabel"), () => fields.onCoopOnlyChange(false));
  const timeToBeatOption = TIME_TO_BEAT_OPTIONS.find((option) => option.value === fields.timeToBeat);
  addSingleChip("timeToBeat", Boolean(timeToBeatOption), timeToBeatOption ? timeToBeatLabel(timeToBeatOption, t) : "", () => fields.onTimeToBeatChange(null));
  addSingleChip("rating", fields.ratingMin !== null, t("games.listToolbar.ratingOption", { min: (fields.ratingMin ?? 0) / 10 }), () => fields.onRatingMinChange(null));
  if (fields.steelbookOnly && fields.onSteelbookOnlyChange) {
    const clear = fields.onSteelbookOnlyChange;
    chips.push({ key: "steelbook", label: t("games.listToolbar.steelbookOnlyLabel"), onRemove: () => clear(false) });
  }
  if (fields.includeAddons && fields.onIncludeAddonsChange) {
    const clear = fields.onIncludeAddonsChange;
    chips.push({ key: "addons", label: t("games.listToolbar.includeAddonsChip"), onRemove: () => clear(false) });
  }
  if (fields.screensaverFilter && fields.onScreensaverFilterChange) {
    const clear = fields.onScreensaverFilterChange;
    chips.push({
      key: "screensaver",
      label:
        fields.screensaverFilter === "hidden"
          ? t("games.listToolbar.screensaverHiddenChip")
          : t("games.listToolbar.screensaverShownChip"),
      onRemove: () => clear(null),
    });
  }

  const menuItem = (key: string, label: ReactNode, selected: boolean, onSelect: () => void, icon?: ReactNode, keepOpen = false) => (
    <ChoiceMenuItem
      key={key}
      label={label}
      icon={icon}
      selected={selected}
      onClick={() => {
        onSelect();
        if (!keepOpen) setMenu(null);
      }}
    />
  );

  const toolbarEnd = (
    <>
      <ToolbarButton
        icon={<TuneIcon />}
        label={t("games.listView.options")}
        onClick={(event) => setMenu({ name: "options", anchor: event.currentTarget })}
        aria-haspopup="menu"
      />
      {showViewMenu ? (
        <ToolbarButton
          icon={VIEW_ICONS[view]}
          label={t("games.listView.view")}
          onClick={(event) => setMenu({ name: "view", anchor: event.currentTarget })}
          aria-haspopup="menu"
        />
      ) : null}
      <ToolbarButton
        icon={<SortIcon />}
        label={t("games.listView.sort")}
        onClick={(event) => setMenu({ name: "sort", anchor: event.currentTarget })}
        aria-haspopup="menu"
      />
      {/* With the Filter Presets lab on, Filter is a split button: its caret opens the presets. */}
      <Box sx={{ display: "inline-flex", flexShrink: 0 }}>
        <ToolbarButton
          icon={<FilterAltOutlinedIcon />}
          label={t("games.listView.filter")}
          count={activeFilterCount}
          active={activeFilterCount > 0}
          onClick={() => setFiltersOpen(true)}
          sx={presetsLab ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 } : undefined}
        />
        {presetsLab ? (
          <ButtonBase
            aria-label={t("games.savedViews.button")}
            aria-haspopup="menu"
            aria-expanded={presets.menuOpen}
            onClick={(event) => presets.openMenu(event.currentTarget)}
            sx={{
              flexShrink: 0,
              // Phones: the toolbar's full 50px height, and wide enough to tap without hitting Filter.
              width: { xs: 32, sm: 26 },
              height: { xs: 50, sm: 34 },
              borderRadius: 1.5,
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
              borderLeft: 1,
              borderColor: "vgt.glassLine",
              color: presets.activeLabel ? "text.primary" : "text.secondary",
              bgcolor: activeFilterCount > 0 ? "vgt.surface2" : "transparent",
              "&:hover": { bgcolor: "vgt.surfaceHover", color: "text.primary" },
              "& svg": { fontSize: 20 },
            }}
          >
            <ArrowDropDownIcon />
          </ButtonBase>
        ) : null}
      </Box>
    </>
  );

  const searchField = (
    <ListSearchField
      value={state.searchKeyword}
      onChange={state.setSearchKeyword}
      label={t("games.listToolbar.searchLabel")}
      placeholder={t("games.listToolbar.searchPlaceholder")}
    />
  );

  const chipRow = chips.length ? (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: -0.5, mb: 1.75 }}>
      {presets.activeLabel ? (
        // The preset in use, first: tapping it opens the presets, its × clears its filters.
        <Chip
          size="small"
          color="primary"
          variant="outlined"
          icon={<BookmarkIcon />}
          label={presets.activeLabel}
          onClick={(event) => presets.openMenu(event.currentTarget)}
          aria-haspopup="menu"
          onDelete={presets.clearActive}
          deleteIcon={<CancelIcon aria-label={t("games.savedViews.clearChip", { name: presets.activeLabel })} />}
        />
      ) : null}
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          size="small"
          label={chip.label}
          onDelete={chip.onRemove}
          deleteIcon={<CancelIcon aria-label={t("games.listView.removeFilter", { label: chip.label })} />}
        />
      ))}
    </Box>
  ) : null;

  const dialogs = (
    <>
      {presets.elements}
      <Menu anchorEl={menu?.anchor} open={menu?.name === "options"} onClose={() => setMenu(null)}>
        {options ?? <CardSizeSlider value={cardSize} onChange={setCardSize} disabled={view !== "covers"} />}
        {toggles.length ? <Divider /> : null}
        {toggles.map((toggle) =>
          menuItem(toggle.key, toggle.label, toggle.checked, () => toggle.onChange(!toggle.checked), undefined, true)
        )}
      </Menu>
      <Menu anchorEl={menu?.anchor} open={menu?.name === "view"} onClose={() => setMenu(null)}>
        {(["covers", "table", "overview"] as GameListView[]).map((option) =>
          menuItem(option, t(`games.listView.view_${option}`), view === option, () => setView(option), VIEW_ICONS[option])
        )}
      </Menu>
      <SortMenu
        anchor={menu?.name === "sort" ? menu.anchor : null}
        onClose={() => setMenu(null)}
        fields={GAME_SORT_FIELDS.filter((option) => !sortFields || sortFields.includes(option.field)).map((option) => ({
          value: option.field,
          label: t(option.labelKey),
        }))}
        field={gameSortField(state.sort)}
        direction={gameSortDirection(state.sort)}
        onFieldChange={(field) => state.setSort(pickGameSortField(state.sort, field))}
        onDirectionChange={(direction) => state.setSort(makeGameSort(gameSortField(state.sort), direction))}
      />
      <GameFilterDialog
        {...fields}
        hidePlatformsField={hidePlatformsField}
        hideCollectionsField={hideCollectionsField}
        hideFranchisesField={hideFranchisesField}
        hideOwnershipField={hideOwnershipField}
        hideFormatsField={hideFormatsField}
        hiddenFields={filterPreferences.hiddenFields}
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
      />
    </>
  );

  return { toolbarEnd, searchField, chipRow, dialogs, activeFilterCount };
}
