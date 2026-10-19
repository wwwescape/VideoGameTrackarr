import { useEffect, useRef, useState } from "react";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import ClearIcon from "@mui/icons-material/Clear";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import FilterListIcon from "@mui/icons-material/FilterList";
import LabelIcon from "@mui/icons-material/Label";
import SearchIcon from "@mui/icons-material/Search";
import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { MatchAllField, MatchAllFilters } from "../api/games";
import type {
  CatalogRefSummary,
  GameCategory,
  GameSortOption,
  GameSource,
  MediaFormat,
  PlatformResponse,
  PlayStatus,
  Tag,
} from "../api/types";
import { GAME_SORT_OPTIONS, type GameSortOptionItem } from "../utils/gameSortOptions";
import AutocompleteMultiSelect from "./AutocompleteMultiSelect";
import AutocompleteSelect from "./AutocompleteSelect";
import TagChip from "./TagChip";

function platformOptionLabel(option: PlatformResponse): string {
  return option.abbreviation ? `${option.name} (${option.abbreviation})` : option.name;
}

export type OwnershipStatus = "owned" | "wishlisted";

interface OwnershipOption {
  value: OwnershipStatus;
  labelKey: string;
}

const OWNERSHIP_OPTIONS: OwnershipOption[] = [
  { value: "owned", labelKey: "games.listToolbar.filterOwned" },
  { value: "wishlisted", labelKey: "games.listToolbar.filterWishlist" },
];

interface PlayStatusOption {
  value: PlayStatus;
  labelKey: string;
}

// Same order and labels as the progress dialog's status picker (GameProgressSection.tsx).
// "Not started" matches a game with no status on any platform (see
// game_repository._play_status_clause), which includes games with no progress logged at all.
const PLAY_STATUS_OPTIONS: PlayStatusOption[] = [
  { value: "none", labelKey: "progress.statusOptions.none" },
  { value: "backlog", labelKey: "progress.statusOptions.backlog" },
  { value: "playing", labelKey: "progress.statusOptions.playing" },
  { value: "completed", labelKey: "progress.statusOptions.completed" },
  { value: "abandoned", labelKey: "progress.statusOptions.abandoned" },
];

interface GameTypeOption {
  value: GameCategory;
  label: string;
}

// Mirrors the backend's _BROWSABLE_CATEGORIES (game_repository.py) exactly — the only
// categories the Games list (and this filter) ever shows a row for. Labels stay hardcoded
// English rather than i18n keys, matching this codebase's existing precedent for category
// value labels (ManualGameForm.tsx's CATEGORY_OPTIONS, utils.ts's ADDON_TYPE_LABELS) — only
// the filter's own label/placeholder chrome is translated, same as every other filter here.
const GAME_TYPE_OPTIONS: GameTypeOption[] = [
  { value: "main_game", label: "Main Game" },
  { value: "bundle", label: "Bundle" },
  { value: "standalone_expansion", label: "Standalone Expansion" },
  { value: "remake", label: "Remake" },
  { value: "remaster", label: "Remaster" },
  { value: "expanded_game", label: "Expanded Game" },
  { value: "port", label: "Port" },
];

interface SourceOption {
  value: GameSource;
  labelKey: string;
}

const SOURCE_OPTIONS: SourceOption[] = [
  { value: "igdb", labelKey: "games.listToolbar.sourceIgdb" },
  { value: "custom", labelKey: "games.card.customLabel" },
];

interface FormatOption {
  value: MediaFormat;
  label: string;
}

// Mirrors the backend's MediaFormat enum exactly (backend/app/models/library.py) — same
// hardcoded-English-label precedent as GAME_TYPE_OPTIONS above, since this is a fixed enum,
// not free text to look up.
const FORMAT_OPTIONS: FormatOption[] = [
  { value: "physical", label: "Physical" },
  { value: "digital", label: "Digital" },
  { value: "iso", label: "ISO" },
  { value: "rom", label: "ROM" },
  { value: "abandonware", label: "Abandonware" },
  { value: "other", label: "Other" },
];

interface ExcludeCheckboxProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}

// Shared "Exclude" toggle under every filter — negates that filter's own predicate ("show
// everything except what's selected"), disabled while nothing is selected since there's
// nothing yet to exclude.
const ExcludeCheckbox = ({ checked, onChange, disabled }: ExcludeCheckboxProps) => {
  const { t } = useTranslation();
  return (
    <FormControlLabel
      sx={{ ml: 0 }}
      control={
        <Checkbox
          size="small"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
      }
      label={t("games.listToolbar.excludeLabel")}
    />
  );
};

interface FilterFieldOptionsProps {
  selectedCount: number;
  exclude: boolean;
  onExcludeChange: (value: boolean) => void;
  // Omitted for Game Types: a game has exactly one, so "all" of two could never match.
  matchAll?: boolean;
  onMatchAllChange?: (value: boolean) => void;
}

// The row under each filter field: Exclude on the left and, where it makes sense, a
// "Match any / Match all" toggle on the right. The toggle stays disabled until two values
// are picked, since "all" of a single value is the same as "any".
const FilterFieldOptions = ({
  selectedCount,
  exclude,
  onExcludeChange,
  matchAll = false,
  onMatchAllChange,
}: FilterFieldOptionsProps) => {
  const { t } = useTranslation();
  return (
    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
      <ExcludeCheckbox checked={exclude} onChange={onExcludeChange} disabled={selectedCount === 0} />
      {onMatchAllChange ? (
        // Wrapped in a span so the tooltip still shows while the group is disabled (a
        // disabled button fires no pointer events) — that's exactly when it's needed.
        <Tooltip title={t("games.listToolbar.matchModeTooltip")}>
          <span>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={matchAll ? "all" : "any"}
              onChange={(_event, value: "any" | "all" | null) => {
                if (value) onMatchAllChange(value === "all");
              }}
              disabled={selectedCount < 2}
              aria-label={t("games.listToolbar.matchModeAriaLabel")}
            >
              <ToggleButton value="any" sx={{ py: 0.25, textTransform: "none" }}>
                {t("games.listToolbar.matchAnyLabel")}
              </ToggleButton>
              <ToggleButton value="all" sx={{ py: 0.25, textTransform: "none" }}>
                {t("games.listToolbar.matchAllLabel")}
              </ToggleButton>
            </ToggleButtonGroup>
          </span>
        </Tooltip>
      ) : null}
    </Stack>
  );
};

interface GameListToolbarProps {
  searchKeyword: string;
  onSearchKeywordChange: (value: string) => void;
  ownershipStatuses: OwnershipStatus[];
  onOwnershipStatusesChange: (value: OwnershipStatus[]) => void;
  ownershipExclude: boolean;
  onOwnershipExcludeChange: (value: boolean) => void;
  // Bulk-selection is optional — only the Games page (GameList.tsx) has bulk actions; the
  // Collection/Series detail page reuses this same toolbar for its search+filters but never
  // passes these, so the "select games" icon and the whole selection-mode bar just don't
  // render (see the render body below).
  selectionMode?: boolean;
  selectedCount?: number;
  visibleCount?: number;
  onEnterSelectionMode?: () => void;
  onExitSelectionMode?: () => void;
  // Toggles between selecting and deselecting every visible game — true once every visible
  // game is already selected, so the button (and its icon/tooltip) can reflect which of the
  // two actions a click will actually perform next, rather than always reading "Select all"
  // with no way to tell the two states apart or reverse a select-all.
  allVisibleSelected?: boolean;
  onToggleSelectAll?: () => void;
  // Optional, same "only rendered when provided" pattern as steelbookOnly/showMissing above —
  // only the Games page wires this up. Surfaced as "Tags" in the Remove split button's
  // dropdown (not a standalone button — see the render body below), opening the bulk Tags
  // dialog (ManageTagsDialog), whose own state/data live in GameList.tsx, keeping this
  // toolbar itself generic.
  onManageTagsClick?: () => void;
  onBulkDelete?: () => void;
  platformOptions: PlatformResponse[];
  platformIds: number[];
  onPlatformIdsChange: (value: number[]) => void;
  // Same reasoning as hideCollectionsField below, for a Platform detail page.
  hidePlatformsField?: boolean;
  platformExclude: boolean;
  onPlatformExcludeChange: (value: boolean) => void;
  tagOptions: Tag[];
  tagIds: number[];
  onTagIdsChange: (value: number[]) => void;
  tagExclude: boolean;
  onTagExcludeChange: (value: boolean) => void;
  collectionOptions: CatalogRefSummary[];
  collectionIds: number[];
  onCollectionIdsChange: (value: number[]) => void;
  collectionExclude: boolean;
  onCollectionExcludeChange: (value: boolean) => void;
  // Skips rendering just the Collections filter field — for a Collection detail page, which
  // is already hard-scoped to one collection (via CatalogBrowseGrid.tsx's own
  // requiredCollectionId), so this field would be confusingly self-referential there.
  hideCollectionsField?: boolean;
  franchiseOptions: CatalogRefSummary[];
  franchiseIds: number[];
  onFranchiseIdsChange: (value: number[]) => void;
  franchiseExclude: boolean;
  onFranchiseExcludeChange: (value: boolean) => void;
  // Same reasoning as hideCollectionsField, for a Series detail page.
  hideFranchisesField?: boolean;
  gameTypes: GameCategory[];
  onGameTypesChange: (value: GameCategory[]) => void;
  gameTypeExclude: boolean;
  onGameTypeExcludeChange: (value: boolean) => void;
  // Skips rendering the Game Types filter field — for the Missing Addons page, where every
  // item shown is inherently an addon (DLC/expansion/pack), so filtering by "Game Type"
  // (main_game/bundle/etc) would never match anything.
  hideGameTypesField?: boolean;
  formats: MediaFormat[];
  onFormatsChange: (value: MediaFormat[]) => void;
  formatExclude: boolean;
  onFormatExcludeChange: (value: boolean) => void;
  storefrontOptions: string[];
  storefronts: string[];
  onStorefrontsChange: (value: string[]) => void;
  storefrontExclude: boolean;
  onStorefrontExcludeChange: (value: boolean) => void;
  // Optional — only the Games page and a Collection/Series detail page (both backed by
  // GameFilterParams' steelbookOnly) pass these; rendered in the Filter tab only when
  // provided. The Missing Addons page doesn't: a not-yet-owned addon has no LibraryItem to
  // check a Steelbook flag against. A plain toggle, not a multi-select with its own Exclude
  // checkbox like every field above — a copy either is or isn't a Steelbook, and "off"
  // already means "don't filter on this," so there's no meaningful third "exclude
  // Steelbooks" state worth a second control for a single boolean.
  steelbookOnly?: boolean;
  onSteelbookOnlyChange?: (value: boolean) => void;
  // Optional, same "only rendered when provided" pattern as steelbookOnly — only the Games
  // page passes these. IGDB-imported vs manually-added (custom) games.
  sources?: GameSource[];
  onSourcesChange?: (value: GameSource[]) => void;
  sourceExclude?: boolean;
  onSourceExcludeChange?: (value: boolean) => void;
  playStatuses: PlayStatus[];
  onPlayStatusesChange: (value: PlayStatus[]) => void;
  playStatusExclude: boolean;
  onPlayStatusExcludeChange: (value: boolean) => void;
  // Every field's Any/All choice in one map (see api/games.ts's MatchAllFilters), rather
  // than another value/onChange prop pair per field.
  matchAll: MatchAllFilters;
  onMatchAllChange: (value: MatchAllFilters) => void;
  sort: GameSortOption;
  onSortChange: (value: GameSortOption) => void;
  // Optional like includeAddons below — the Games page never shows a still-undiscovered
  // "what's missing" game at all (see GameList.tsx), so it has no use for this toggle either;
  // same for the Missing Addons page (it's already inherently "what's missing"). Either
  // page's More tab ends up with just Sort By when neither this nor includeAddons is passed.
  showMissing?: boolean;
  onShowMissingChange?: (value: boolean) => void;
  // Only the Collection/Series detail page passes these — rendered in the More tab right
  // under Show Missing only when provided.
  includeAddons?: boolean;
  onIncludeAddonsChange?: (value: boolean) => void;
}

// Sticky-feeling toolbar (rendered once, above the virtualized grid) that swaps between
// two rows depending on mode: search + a Filters & Sort button normally, or a contextual
// selection action bar once the user has entered bulk-select mode.
const GameListToolbar = ({
  searchKeyword,
  onSearchKeywordChange,
  ownershipStatuses,
  onOwnershipStatusesChange,
  ownershipExclude,
  onOwnershipExcludeChange,
  selectionMode = false,
  selectedCount = 0,
  visibleCount = 0,
  onEnterSelectionMode,
  onExitSelectionMode = () => {},
  allVisibleSelected = false,
  onToggleSelectAll = () => {},
  onManageTagsClick,
  onBulkDelete = () => {},
  platformOptions,
  hidePlatformsField = false,
  platformIds,
  onPlatformIdsChange,
  platformExclude,
  onPlatformExcludeChange,
  tagOptions,
  tagIds,
  onTagIdsChange,
  tagExclude,
  onTagExcludeChange,
  collectionOptions,
  collectionIds,
  onCollectionIdsChange,
  collectionExclude,
  onCollectionExcludeChange,
  hideCollectionsField = false,
  franchiseOptions,
  franchiseIds,
  onFranchiseIdsChange,
  franchiseExclude,
  onFranchiseExcludeChange,
  hideFranchisesField = false,
  gameTypes,
  onGameTypesChange,
  gameTypeExclude,
  onGameTypeExcludeChange,
  hideGameTypesField = false,
  formats,
  onFormatsChange,
  formatExclude,
  onFormatExcludeChange,
  storefrontOptions,
  storefronts,
  onStorefrontsChange,
  storefrontExclude,
  onStorefrontExcludeChange,
  steelbookOnly,
  onSteelbookOnlyChange,
  sources = [],
  onSourcesChange,
  sourceExclude = false,
  onSourceExcludeChange,
  playStatuses,
  onPlayStatusesChange,
  playStatusExclude,
  onPlayStatusExcludeChange,
  matchAll,
  onMatchAllChange,
  sort,
  onSortChange,
  showMissing,
  onShowMissingChange,
  includeAddons,
  onIncludeAddonsChange,
}: GameListToolbarProps) => {
  const { t } = useTranslation();
  const allPlaceholder = t("games.listToolbar.allOption");
  const selectedTags = tagOptions.filter((tag) => tagIds.includes(tag.id));
  const selectedPlatforms = platformOptions.filter((platform) => platformIds.includes(platform.id));
  const selectedCollections = collectionOptions.filter((collection) =>
    collectionIds.includes(collection.id)
  );
  const selectedFranchises = franchiseOptions.filter((franchise) =>
    franchiseIds.includes(franchise.id)
  );
  const selectedGameTypes = GAME_TYPE_OPTIONS.filter((option) => gameTypes.includes(option.value));
  const selectedFormats = FORMAT_OPTIONS.filter((option) => formats.includes(option.value));
  const selectedOwnershipStatuses = OWNERSHIP_OPTIONS.filter((option) =>
    ownershipStatuses.includes(option.value)
  );
  const selectedSources = SOURCE_OPTIONS.filter((option) => sources.includes(option.value));
  const selectedPlayStatuses = PLAY_STATUS_OPTIONS.filter((option) =>
    playStatuses.includes(option.value)
  );
  const matchAllProps = (field: MatchAllField) => ({
    matchAll: Boolean(matchAll[field]),
    onMatchAllChange: (value: boolean) => onMatchAllChange({ ...matchAll, [field]: value }),
  });
  const selectedSortOption =
    GAME_SORT_OPTIONS.find((option) => option.value === sort) ?? GAME_SORT_OPTIONS[0];
  const showStorefrontFilter = formats.includes("digital");
  const activeFilterCount =
    ownershipStatuses.length +
    platformIds.length +
    tagIds.length +
    collectionIds.length +
    franchiseIds.length +
    gameTypes.length +
    formats.length +
    storefronts.length +
    playStatuses.length +
    sources.length +
    (steelbookOnly ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"filter" | "more">("filter");
  // The Remove split button's dropdown (currently just "Tags") — anchored to the whole
  // ButtonGroup (via buttonGroupRef), not just the small arrow segment, so the menu below
  // can match its full width/left/right bounds instead of hugging the arrow alone.
  const [bulkActionsMenuOpen, setBulkActionsMenuOpen] = useState(false);
  const buttonGroupRef = useRef<HTMLDivElement>(null);

  // Storefront only makes sense once Digital is one of the selected Formats — if Digital
  // gets deselected while a storefront filter is still set, clear it rather than leaving a
  // hidden filter silently affecting results.
  useEffect(() => {
    if (!showStorefrontFilter && (storefronts.length > 0 || storefrontExclude)) {
      onStorefrontsChange([]);
      onStorefrontExcludeChange(false);
    }
  }, [
    showStorefrontFilter,
    storefronts.length,
    storefrontExclude,
    onStorefrontsChange,
    onStorefrontExcludeChange,
  ]);

  const handleClearFilters = () => {
    onOwnershipStatusesChange([]);
    onOwnershipExcludeChange(false);
    onPlatformIdsChange([]);
    onPlatformExcludeChange(false);
    onTagIdsChange([]);
    onTagExcludeChange(false);
    onCollectionIdsChange([]);
    onCollectionExcludeChange(false);
    onFranchiseIdsChange([]);
    onFranchiseExcludeChange(false);
    onGameTypesChange([]);
    onGameTypeExcludeChange(false);
    onFormatsChange([]);
    onFormatExcludeChange(false);
    onStorefrontsChange([]);
    onStorefrontExcludeChange(false);
    onPlayStatusesChange([]);
    onPlayStatusExcludeChange(false);
    onMatchAllChange({});
    onSteelbookOnlyChange?.(false);
    onSourcesChange?.([]);
    onSourceExcludeChange?.(false);
  };

  if (selectionMode) {
    return (
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <IconButton
            onClick={onExitSelectionMode}
            aria-label={t("games.listToolbar.exitSelectionModeAriaLabel")}
          >
            <CloseIcon />
          </IconButton>
          <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
            {t("games.listToolbar.selectedCount", { count: selectedCount })}
          </Typography>
          <Tooltip
            title={
              allVisibleSelected
                ? t("games.listToolbar.deselectAllTooltip")
                : t("games.listToolbar.selectAllTooltip")
            }
          >
            <IconButton
              onClick={onToggleSelectAll}
              aria-label={
                allVisibleSelected
                  ? t("games.listToolbar.deselectAllAriaLabel")
                  : t("games.listToolbar.selectAllAriaLabel")
              }
              aria-pressed={allVisibleSelected}
              disabled={visibleCount === 0}
              color={allVisibleSelected ? "primary" : "default"}
              sx={{ bgcolor: allVisibleSelected ? "action.selected" : undefined }}
            >
              <DoneAllIcon />
            </IconButton>
          </Tooltip>
          <ButtonGroup ref={buttonGroupRef} color="error" variant="contained" disabled={selectedCount === 0}>
            <Button startIcon={<DeleteIcon />} onClick={onBulkDelete}>
              {t("common.remove")}
            </Button>
            {onManageTagsClick ? (
              <Button
                size="small"
                onClick={() => setBulkActionsMenuOpen(true)}
                aria-label={t("games.listToolbar.moreBulkActionsAriaLabel")}
                aria-haspopup="menu"
                aria-expanded={bulkActionsMenuOpen}
              >
                <ArrowDropDownIcon />
              </Button>
            ) : null}
          </ButtonGroup>
          <Menu
            anchorEl={buttonGroupRef.current}
            open={bulkActionsMenuOpen}
            onClose={() => setBulkActionsMenuOpen(false)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
            slotProps={{
              list: { sx: { py: 0 } },
              paper: {
                sx: {
                  mt: 0.5,
                  width: buttonGroupRef.current?.offsetWidth,
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                },
              },
            }}
          >
            {onManageTagsClick ? (
              <MenuItem
                onClick={() => {
                  setBulkActionsMenuOpen(false);
                  onManageTagsClick();
                }}
                sx={{ minHeight: buttonGroupRef.current?.offsetHeight }}
              >
                <ListItemIcon>
                  <LabelIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t("games.listToolbar.manageTagsButton")}</ListItemText>
              </MenuItem>
            ) : null}
          </Menu>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1}>
          <TextField
            label={t("games.listToolbar.searchLabel")}
            variant="outlined"
            value={searchKeyword}
            onChange={(event) => onSearchKeywordChange(event.target.value)}
            placeholder={t("games.listToolbar.searchPlaceholder")}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon style={{ cursor: "pointer" }} />
                  </InputAdornment>
                ),
                endAdornment: searchKeyword && (
                  <InputAdornment position="end" onClick={() => onSearchKeywordChange("")}>
                    <ClearIcon style={{ cursor: "pointer" }} />
                  </InputAdornment>
                ),
              },
            }}
            fullWidth
          />
          <Tooltip title={t("games.listToolbar.filtersButtonLabel")}>
            <IconButton
              onClick={() => setFiltersOpen(true)}
              aria-label={t("games.listToolbar.filtersButtonLabel")}
              sx={{ alignSelf: "center" }}
            >
              <Badge badgeContent={activeFilterCount} color="primary">
                <FilterListIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          {onEnterSelectionMode ? (
            <Tooltip title={t("games.listToolbar.selectGames")}>
              <IconButton
                onClick={onEnterSelectionMode}
                aria-label={t("games.listToolbar.selectGames")}
                disabled={visibleCount === 0}
                sx={{ alignSelf: "center" }}
              >
                <CheckBoxOutlineBlankIcon />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
        <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} fullWidth maxWidth="md">
          <DialogTitle>{t("games.listToolbar.filtersButtonLabel")}</DialogTitle>
          <Tabs
            value={activeTab}
            onChange={(_event, value) => setActiveTab(value)}
            variant="fullWidth"
          >
            <Tab value="filter" label={t("games.listToolbar.filterTabLabel")} />
            <Tab value="more" label={t("games.listToolbar.moreTabLabel")} />
          </Tabs>
          <DialogContent>
            {activeTab === "filter" ? (
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                {!hideGameTypesField ? (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Stack spacing={0.5}>
                      <AutocompleteMultiSelect<GameTypeOption>
                        label={t("games.listToolbar.gameTypeLabel")}
                        options={GAME_TYPE_OPTIONS}
                        value={selectedGameTypes}
                        onChange={(newValue) =>
                          onGameTypesChange(newValue.map((option) => option.value))
                        }
                        getOptionLabel={(option) => option.label}
                        isOptionEqualToValue={(option, val) => option.value === val.value}
                        placeholder={allPlaceholder}
                        fullWidth
                      />
                      <FilterFieldOptions
                        selectedCount={gameTypes.length}
                        exclude={gameTypeExclude}
                        onExcludeChange={onGameTypeExcludeChange}
                      />
                    </Stack>
                  </Grid>
                ) : null}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Stack spacing={0.5}>
                    <AutocompleteMultiSelect<Tag>
                      label={t("games.listToolbar.tagLabel")}
                      options={tagOptions}
                      value={selectedTags}
                      onChange={(newValue) => onTagIdsChange(newValue.map((tag) => tag.id))}
                      getOptionLabel={(option) => option.name}
                      isOptionEqualToValue={(option, val) => option.id === val.id}
                      placeholder={allPlaceholder}
                      fullWidth
                      renderValue={(tagsValue, getItemProps) =>
                        tagsValue.map((tag, index) => {
                          const { key, ...itemProps } = getItemProps({ index });
                          return <TagChip key={key} tag={tag} {...itemProps} />;
                        })
                      }
                    />
                    <FilterFieldOptions
                      selectedCount={tagIds.length}
                      exclude={tagExclude}
                      onExcludeChange={onTagExcludeChange}
                      {...matchAllProps("tag")}
                    />
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Stack spacing={0.5}>
                    <AutocompleteMultiSelect<OwnershipOption>
                      label={t("games.listToolbar.ownershipLabel")}
                      options={OWNERSHIP_OPTIONS}
                      value={selectedOwnershipStatuses}
                      onChange={(newValue) =>
                        onOwnershipStatusesChange(newValue.map((option) => option.value))
                      }
                      getOptionLabel={(option) => t(option.labelKey)}
                      isOptionEqualToValue={(option, val) => option.value === val.value}
                      placeholder={allPlaceholder}
                      fullWidth
                    />
                    <FilterFieldOptions
                      selectedCount={ownershipStatuses.length}
                      exclude={ownershipExclude}
                      onExcludeChange={onOwnershipExcludeChange}
                      {...matchAllProps("ownership")}
                    />
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Stack spacing={0.5}>
                    <AutocompleteMultiSelect<PlayStatusOption>
                      label={t("games.listToolbar.playStatusLabel")}
                      options={PLAY_STATUS_OPTIONS}
                      value={selectedPlayStatuses}
                      onChange={(newValue) =>
                        onPlayStatusesChange(newValue.map((option) => option.value))
                      }
                      getOptionLabel={(option) => t(option.labelKey)}
                      isOptionEqualToValue={(option, val) => option.value === val.value}
                      placeholder={allPlaceholder}
                      fullWidth
                    />
                    <FilterFieldOptions
                      selectedCount={playStatuses.length}
                      exclude={playStatusExclude}
                      onExcludeChange={onPlayStatusExcludeChange}
                      {...matchAllProps("playStatus")}
                    />
                  </Stack>
                </Grid>
                {!hidePlatformsField ? (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Stack spacing={0.5}>
                    <AutocompleteMultiSelect<PlatformResponse>
                      label={t("games.listToolbar.consoleLabel")}
                      options={platformOptions}
                      value={selectedPlatforms}
                      onChange={(newValue) =>
                        onPlatformIdsChange(newValue.map((platform) => platform.id))
                      }
                      getOptionLabel={platformOptionLabel}
                      isOptionEqualToValue={(option, val) => option.id === val.id}
                      placeholder={allPlaceholder}
                      fullWidth
                    />
                    <FilterFieldOptions
                      selectedCount={platformIds.length}
                      exclude={platformExclude}
                      onExcludeChange={onPlatformExcludeChange}
                      {...matchAllProps("platform")}
                    />
                  </Stack>
                </Grid>
                ) : null}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Stack spacing={0.5}>
                    <AutocompleteMultiSelect<FormatOption>
                      label={t("games.listToolbar.formatLabel")}
                      options={FORMAT_OPTIONS}
                      value={selectedFormats}
                      onChange={(newValue) =>
                        onFormatsChange(newValue.map((option) => option.value))
                      }
                      getOptionLabel={(option) => option.label}
                      isOptionEqualToValue={(option, val) => option.value === val.value}
                      placeholder={allPlaceholder}
                      fullWidth
                    />
                    <FilterFieldOptions
                      selectedCount={formats.length}
                      exclude={formatExclude}
                      onExcludeChange={onFormatExcludeChange}
                      {...matchAllProps("format")}
                    />
                  </Stack>
                </Grid>
                {showStorefrontFilter ? (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Stack spacing={0.5}>
                      <AutocompleteMultiSelect<string>
                        label={t("games.listToolbar.storefrontLabel")}
                        options={storefrontOptions}
                        value={storefronts}
                        onChange={onStorefrontsChange}
                        getOptionLabel={(option) => option}
                        isOptionEqualToValue={(option, val) => option === val}
                        placeholder={allPlaceholder}
                        fullWidth
                      />
                      <FilterFieldOptions
                        selectedCount={storefronts.length}
                        exclude={storefrontExclude}
                        onExcludeChange={onStorefrontExcludeChange}
                        {...matchAllProps("storefront")}
                      />
                    </Stack>
                  </Grid>
                ) : null}
                {onSteelbookOnlyChange ? (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(steelbookOnly)}
                          onChange={(event) => onSteelbookOnlyChange(event.target.checked)}
                        />
                      }
                      label={t("games.listToolbar.steelbookOnlyLabel")}
                    />
                  </Grid>
                ) : null}
                {!hideCollectionsField ? (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Stack spacing={0.5}>
                      <AutocompleteMultiSelect<CatalogRefSummary>
                        label={t("games.listToolbar.collectionLabel")}
                        options={collectionOptions}
                        value={selectedCollections}
                        onChange={(newValue) =>
                          onCollectionIdsChange(newValue.map((collection) => collection.id))
                        }
                        getOptionLabel={(option) => option.name}
                        isOptionEqualToValue={(option, val) => option.id === val.id}
                        placeholder={allPlaceholder}
                        fullWidth
                      />
                      <FilterFieldOptions
                        selectedCount={collectionIds.length}
                        exclude={collectionExclude}
                        onExcludeChange={onCollectionExcludeChange}
                        {...matchAllProps("collection")}
                      />
                    </Stack>
                  </Grid>
                ) : null}
                {!hideFranchisesField ? (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Stack spacing={0.5}>
                      <AutocompleteMultiSelect<CatalogRefSummary>
                        label={t("games.listToolbar.seriesLabel")}
                        options={franchiseOptions}
                        value={selectedFranchises}
                        onChange={(newValue) =>
                          onFranchiseIdsChange(newValue.map((franchise) => franchise.id))
                        }
                        getOptionLabel={(option) => option.name}
                        isOptionEqualToValue={(option, val) => option.id === val.id}
                        placeholder={allPlaceholder}
                        fullWidth
                      />
                      <FilterFieldOptions
                        selectedCount={franchiseIds.length}
                        exclude={franchiseExclude}
                        onExcludeChange={onFranchiseExcludeChange}
                        {...matchAllProps("franchise")}
                      />
                    </Stack>
                  </Grid>
                ) : null}
                {onSourcesChange ? (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Stack spacing={0.5}>
                      <AutocompleteMultiSelect<SourceOption>
                        label={t("games.listToolbar.sourceLabel")}
                        options={SOURCE_OPTIONS}
                        value={selectedSources}
                        onChange={(newValue) =>
                          onSourcesChange(newValue.map((option) => option.value))
                        }
                        getOptionLabel={(option) => t(option.labelKey)}
                        isOptionEqualToValue={(option, val) => option.value === val.value}
                        placeholder={allPlaceholder}
                        fullWidth
                      />
                      <FilterFieldOptions
                        selectedCount={sources.length}
                        exclude={sourceExclude}
                        onExcludeChange={(value) => onSourceExcludeChange?.(value)}
                      />
                    </Stack>
                  </Grid>
                ) : null}
              </Grid>
            ) : (
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <AutocompleteSelect<GameSortOptionItem>
                    label={t("games.listToolbar.sortByLabel")}
                    options={GAME_SORT_OPTIONS}
                    value={selectedSortOption}
                    onChange={(newValue) => onSortChange(newValue?.value ?? "name_asc")}
                    getOptionLabel={(option) => t(option.labelKey)}
                    isOptionEqualToValue={(option, val) => option.value === val.value}
                    disableClearable
                    fullWidth
                  />
                </Grid>
                {onShowMissingChange || onIncludeAddonsChange ? (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Stack spacing={0.5}>
                      {onShowMissingChange ? (
                        <FormControlLabel
                          control={
                            <Switch
                              checked={Boolean(showMissing)}
                              onChange={(event) => onShowMissingChange(event.target.checked)}
                            />
                          }
                          label={t("games.listToolbar.showMissingLabel")}
                        />
                      ) : null}
                      {onIncludeAddonsChange ? (
                        <FormControlLabel
                          control={
                            <Switch
                              checked={Boolean(includeAddons)}
                              onChange={(event) => onIncludeAddonsChange(event.target.checked)}
                            />
                          }
                          label={t("catalog.browseGrid.includeAddonsLabel")}
                        />
                      ) : null}
                    </Stack>
                  </Grid>
                ) : null}
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            {activeTab === "filter" ? (
              <Button onClick={handleClearFilters} disabled={!hasActiveFilters}>
                {t("games.listToolbar.clearFiltersButton")}
              </Button>
            ) : null}
            <Button onClick={() => setFiltersOpen(false)} variant="contained">
              {t("common.close")}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Paper>
  );
};

export default GameListToolbar;
