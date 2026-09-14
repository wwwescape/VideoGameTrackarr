import { useEffect, useState } from "react";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import ClearIcon from "@mui/icons-material/Clear";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type {
  CatalogRefSummary,
  GameCategory,
  GameSortOption,
  MediaFormat,
  PlatformResponse,
  Tag,
} from "../api/types";
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

interface SortOption {
  value: GameSortOption;
  labelKey: string;
}

const SORT_OPTIONS: SortOption[] = [
  { value: "name_asc", labelKey: "games.listToolbar.sortNameAsc" },
  { value: "name_desc", labelKey: "games.listToolbar.sortNameDesc" },
  { value: "release_date_asc", labelKey: "games.listToolbar.sortReleaseDateAsc" },
  { value: "release_date_desc", labelKey: "games.listToolbar.sortReleaseDateDesc" },
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
  onSelectAllVisible?: () => void;
  onBulkDelete?: () => void;
  platformOptions: PlatformResponse[];
  platformIds: number[];
  onPlatformIdsChange: (value: number[]) => void;
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
  onSelectAllVisible = () => {},
  onBulkDelete = () => {},
  platformOptions,
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
  const selectedSortOption =
    SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];
  const showStorefrontFilter = formats.includes("digital");
  const activeFilterCount =
    ownershipStatuses.length +
    platformIds.length +
    tagIds.length +
    collectionIds.length +
    franchiseIds.length +
    gameTypes.length +
    formats.length +
    storefronts.length;
  const hasActiveFilters = activeFilterCount > 0;

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"filter" | "more">("filter");

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
          <Tooltip title={t("games.listToolbar.selectAllTooltip")}>
            <IconButton
              onClick={onSelectAllVisible}
              aria-label={t("games.listToolbar.selectAllAriaLabel")}
              disabled={visibleCount === 0}
            >
              <DoneAllIcon />
            </IconButton>
          </Tooltip>
          <Button
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
            disabled={selectedCount === 0}
            onClick={onBulkDelete}
          >
            {t("common.remove")}
          </Button>
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
                    <ExcludeCheckbox
                      checked={ownershipExclude}
                      onChange={onOwnershipExcludeChange}
                      disabled={ownershipStatuses.length === 0}
                    />
                  </Stack>
                </Grid>
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
                    <ExcludeCheckbox
                      checked={platformExclude}
                      onChange={onPlatformExcludeChange}
                      disabled={platformIds.length === 0}
                    />
                  </Stack>
                </Grid>
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
                    <ExcludeCheckbox
                      checked={tagExclude}
                      onChange={onTagExcludeChange}
                      disabled={tagIds.length === 0}
                    />
                  </Stack>
                </Grid>
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
                      <ExcludeCheckbox
                        checked={collectionExclude}
                        onChange={onCollectionExcludeChange}
                        disabled={collectionIds.length === 0}
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
                      <ExcludeCheckbox
                        checked={franchiseExclude}
                        onChange={onFranchiseExcludeChange}
                        disabled={franchiseIds.length === 0}
                      />
                    </Stack>
                  </Grid>
                ) : null}
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
                      <ExcludeCheckbox
                        checked={gameTypeExclude}
                        onChange={onGameTypeExcludeChange}
                        disabled={gameTypes.length === 0}
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
                    <ExcludeCheckbox
                      checked={formatExclude}
                      onChange={onFormatExcludeChange}
                      disabled={formats.length === 0}
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
                      <ExcludeCheckbox
                        checked={storefrontExclude}
                        onChange={onStorefrontExcludeChange}
                        disabled={storefronts.length === 0}
                      />
                    </Stack>
                  </Grid>
                ) : null}
              </Grid>
            ) : (
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <AutocompleteSelect<SortOption>
                    label={t("games.listToolbar.sortByLabel")}
                    options={SORT_OPTIONS}
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
