import { useState, type ReactNode } from "react";
import CancelIcon from "@mui/icons-material/Cancel";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import GridViewIcon from "@mui/icons-material/GridView";
import SortIcon from "@mui/icons-material/Sort";
import TableRowsIcon from "@mui/icons-material/TableRows";
import TuneIcon from "@mui/icons-material/Tune";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import { useTranslation } from "react-i18next";
import type { GameListState } from "../hooks/useGameListState";
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
  platformOptionLabel,
  SOURCE_OPTIONS,
} from "./GameFilterDialog";
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
  view: GameListView;
  setView: (view: GameListView) => void;
  cardSize: number;
  setCardSize: (size: number) => void;
  // Pages already scoped to one platform/collection/series hide that filter field.
  hidePlatformsField?: boolean;
  hideCollectionsField?: boolean;
  hideFranchisesField?: boolean;
  toggles?: ListToggle[];
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
    view,
    setView,
    cardSize,
    setCardSize,
    hidePlatformsField,
    hideCollectionsField,
    hideFranchisesField,
    toggles = [],
    showViewMenu = true,
    sortFields,
  }: GameListControlsOptions
) {
  const { t } = useTranslation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menu, setMenu] = useState<{ name: "options" | "view" | "sort"; anchor: HTMLElement } | null>(null);
  const { fields } = state;

  const activeFilterCount = countActiveFilters({
    ownershipStatuses: fields.ownershipStatuses,
    platformIds: hidePlatformsField ? [] : fields.platformIds,
    tagIds: fields.tagIds,
    collectionIds: hideCollectionsField ? [] : fields.collectionIds,
    franchiseIds: hideFranchisesField ? [] : fields.franchiseIds,
    gameTypes: fields.gameTypes,
    formats: fields.formats,
    storefronts: fields.storefronts,
    playStatuses: fields.playStatuses,
    sources: fields.sources,
    steelbookOnly: fields.steelbookOnly,
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
  addChips("ownership", fields.ownershipStatuses, fields.ownershipExclude, (value) => t(OWNERSHIP_OPTIONS.find((o) => o.value === value)?.labelKey ?? ""), fields.onOwnershipStatusesChange, fields.onOwnershipExcludeChange);
  addChips("playStatus", fields.playStatuses, fields.playStatusExclude, (value) => t(PLAY_STATUS_OPTIONS.find((o) => o.value === value)?.labelKey ?? ""), fields.onPlayStatusesChange, fields.onPlayStatusExcludeChange);
  if (!hidePlatformsField) {
    addChips("platform", fields.platformIds, fields.platformExclude, (id) => {
      const platform = fields.platformOptions.find((p) => p.id === id);
      return platform ? platformOptionLabel(platform) : undefined;
    }, fields.onPlatformIdsChange, fields.onPlatformExcludeChange);
  }
  addChips("tag", fields.tagIds, fields.tagExclude, (id) => fields.tagOptions.find((tag) => tag.id === id)?.name, fields.onTagIdsChange, fields.onTagExcludeChange);
  if (!hideCollectionsField) {
    addChips("collection", fields.collectionIds, fields.collectionExclude, (id) => fields.collectionOptions.find((c) => c.id === id)?.name, fields.onCollectionIdsChange, fields.onCollectionExcludeChange);
  }
  if (!hideFranchisesField) {
    addChips("series", fields.franchiseIds, fields.franchiseExclude, (id) => fields.franchiseOptions.find((f) => f.id === id)?.name, fields.onFranchiseIdsChange, fields.onFranchiseExcludeChange);
  }
  addChips("type", fields.gameTypes, fields.gameTypeExclude, (value) => GAME_TYPE_OPTIONS.find((o) => o.value === value)?.label, fields.onGameTypesChange, fields.onGameTypeExcludeChange);
  addChips("format", fields.formats, fields.formatExclude, (value) => FORMAT_OPTIONS.find((o) => o.value === value)?.label, fields.onFormatsChange, fields.onFormatExcludeChange);
  addChips("storefront", fields.storefronts, fields.storefrontExclude, (value) => value, fields.onStorefrontsChange, fields.onStorefrontExcludeChange);
  if (fields.sources && fields.onSourcesChange) {
    addChips("source", fields.sources, fields.sourceExclude, (value) => t(SOURCE_OPTIONS.find((o) => o.value === value)?.labelKey ?? ""), fields.onSourcesChange, fields.onSourceExcludeChange);
  }
  if (fields.steelbookOnly && fields.onSteelbookOnlyChange) {
    const clear = fields.onSteelbookOnlyChange;
    chips.push({ key: "steelbook", label: t("games.listToolbar.steelbookOnlyLabel"), onRemove: () => clear(false) });
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
      <ToolbarButton
        icon={<FilterAltOutlinedIcon />}
        label={t("games.listView.filter")}
        count={activeFilterCount}
        active={activeFilterCount > 0}
        onClick={() => setFiltersOpen(true)}
      />
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
      <Menu anchorEl={menu?.anchor} open={menu?.name === "options"} onClose={() => setMenu(null)}>
        <CardSizeSlider value={cardSize} onChange={setCardSize} disabled={view !== "covers"} />
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
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
      />
    </>
  );

  return { toolbarEnd, searchField, chipRow, dialogs, activeFilterCount };
}
