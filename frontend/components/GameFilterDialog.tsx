import { useEffect } from "react";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { MatchAllField, MatchAllFilters } from "../api/games";
import type { GameFilterFieldKey } from "../hooks/useGameFilterPreferences";
import TextField from "@mui/material/TextField";
import type {
  CatalogRefSummary,
  GameCategory,
  GameSource,
  GenreSummary,
  MediaFormat,
  PlayStatus,
  ReleaseStatus,
  Tag,
} from "../api/types";
import AutocompleteMultiSelect from "./AutocompleteMultiSelect";
import AutocompleteSelect from "./AutocompleteSelect";
import TagChip from "./TagChip";

// A Games → Platforms card ("Switch", "PC · Steam", ...) as a Platforms filter value — keyed by
// utils/platformScope.ts's platformScopeKey, which is what the backend's platformScope takes.
export interface PlatformFilterOption {
  id: string;
  label: string;
}

export type OwnershipStatus = "owned" | "wishlisted";

interface OwnershipOption {
  value: OwnershipStatus;
  labelKey: string;
}

export const OWNERSHIP_OPTIONS: OwnershipOption[] = [
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
export const PLAY_STATUS_OPTIONS: PlayStatusOption[] = [
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
export const GAME_TYPE_OPTIONS: GameTypeOption[] = [
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

export const SOURCE_OPTIONS: SourceOption[] = [
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
export const FORMAT_OPTIONS: FormatOption[] = [
  { value: "physical", label: "Physical" },
  { value: "digital", label: "Digital" },
  { value: "iso", label: "ISO" },
  { value: "rom", label: "ROM" },
  { value: "abandonware", label: "Abandonware" },
  { value: "other", label: "Other" },
];

interface ReleaseStatusOption {
  value: ReleaseStatus;
  labelKey: string;
}

export const RELEASE_STATUS_OPTIONS: ReleaseStatusOption[] = [
  { value: "released", labelKey: "games.listToolbar.releaseReleased" },
  { value: "upcoming", labelKey: "games.listToolbar.releaseUpcoming" },
];

// "At least N players on one console/screen" — IGDB's offline max, the most a couch can share.
export const LOCAL_PLAYERS_OPTIONS = [1, 2, 3, 4];

export type TimeToBeatRange = "under5" | "5to15" | "15to40" | "over40";

interface TimeToBeatOption {
  value: TimeToBeatRange;
  // Hours on IGDB's main-story estimate; min inclusive, max exclusive (the backend's
  // timeToBeatMin/timeToBeatMax).
  min?: number;
  max?: number;
}

export const TIME_TO_BEAT_OPTIONS: TimeToBeatOption[] = [
  { value: "under5", max: 5 },
  { value: "5to15", min: 5, max: 15 },
  { value: "15to40", min: 15, max: 40 },
  { value: "over40", min: 40 },
];

// IGDB's members rating (igdb_rating), stored 0-100 and shown /10 like the game page.
export const RATING_OPTIONS = [60, 75, 85];

export function timeToBeatLabel(option: TimeToBeatOption, t: TFunction): string {
  if (option.min === undefined) return t("games.listToolbar.timeToBeatUnder", { max: option.max });
  if (option.max === undefined) return t("games.listToolbar.timeToBeatOver", { min: option.min });
  return t("games.listToolbar.timeToBeatBetween", { min: option.min, max: option.max });
}

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

export interface GameFilterFieldsProps {
  ownershipStatuses: OwnershipStatus[];
  onOwnershipStatusesChange: (value: OwnershipStatus[]) => void;
  ownershipExclude: boolean;
  onOwnershipExcludeChange: (value: boolean) => void;
  platformOptions: PlatformFilterOption[];
  platformKeys: string[];
  onPlatformKeysChange: (value: string[]) => void;
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
  genreOptions: GenreSummary[];
  genreIds: number[];
  onGenreIdsChange: (value: number[]) => void;
  genreExclude: boolean;
  onGenreExcludeChange: (value: boolean) => void;
  releaseStatuses: ReleaseStatus[];
  onReleaseStatusesChange: (value: ReleaseStatus[]) => void;
  releaseYearFrom: number | null;
  onReleaseYearFromChange: (value: number | null) => void;
  releaseYearTo: number | null;
  onReleaseYearToChange: (value: number | null) => void;
  // The IGDB-backed fields below only ever match games IGDB has data for — a game it knows
  // nothing about (players, length, rating) is left out rather than guessed at.
  localPlayersMin: number | null;
  onLocalPlayersMinChange: (value: number | null) => void;
  onlineMultiplayerOnly: boolean;
  onOnlineMultiplayerOnlyChange: (value: boolean) => void;
  coopOnly: boolean;
  onCoopOnlyChange: (value: boolean) => void;
  timeToBeat: TimeToBeatRange | null;
  onTimeToBeatChange: (value: TimeToBeatRange | null) => void;
  ratingMin: number | null;
  onRatingMinChange: (value: number | null) => void;
}

interface GameFilterDialogProps extends GameFilterFieldsProps {
  open: boolean;
  onClose: () => void;
  // Fields switched off in Settings (see useGameFilterPreferences). A hidden field's filter
  // still applies, and still shows as a chip on the list, so it can be cleared from there.
  hiddenFields?: ReadonlySet<GameFilterFieldKey>;
}

// How many filter values are set — the Filter button's badge.
export function countActiveFilters(fields: {
  ownershipStatuses: unknown[];
  platformKeys: unknown[];
  tagIds: unknown[];
  collectionIds: unknown[];
  franchiseIds: unknown[];
  gameTypes: unknown[];
  formats: unknown[];
  storefronts: unknown[];
  playStatuses: unknown[];
  sources?: unknown[];
  steelbookOnly?: boolean;
  genreIds?: unknown[];
  releaseStatuses?: unknown[];
  releaseYearFrom?: number | null;
  releaseYearTo?: number | null;
  localPlayersMin?: number | null;
  onlineMultiplayerOnly?: boolean;
  coopOnly?: boolean;
  timeToBeat?: string | null;
  ratingMin?: number | null;
}): number {
  const isSet = (value: unknown) => (value !== null && value !== undefined && value !== false ? 1 : 0);
  return (
    fields.ownershipStatuses.length +
    fields.platformKeys.length +
    fields.tagIds.length +
    fields.collectionIds.length +
    fields.franchiseIds.length +
    fields.gameTypes.length +
    fields.formats.length +
    fields.storefronts.length +
    fields.playStatuses.length +
    (fields.sources?.length ?? 0) +
    (fields.steelbookOnly ? 1 : 0) +
    (fields.genreIds?.length ?? 0) +
    (fields.releaseStatuses?.length ?? 0) +
    isSet(fields.releaseYearFrom) +
    isSet(fields.releaseYearTo) +
    isSet(fields.localPlayersMin) +
    isSet(fields.onlineMultiplayerOnly) +
    isSet(fields.coopOnly) +
    isSet(fields.timeToBeat) +
    isSet(fields.ratingMin)
  );
}

// The game-list filters: every field with Exclude (and Match any/all where it applies). Sort and
// a page's own toggles (Show what I'm missing, Include add-ons) live in its toolbar menus.
const GameFilterDialog = ({
  ownershipStatuses,
  onOwnershipStatusesChange,
  ownershipExclude,
  onOwnershipExcludeChange,
  platformOptions,
  hidePlatformsField = false,
  platformKeys,
  onPlatformKeysChange,
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
  genreOptions,
  genreIds,
  onGenreIdsChange,
  genreExclude,
  onGenreExcludeChange,
  releaseStatuses,
  onReleaseStatusesChange,
  releaseYearFrom,
  onReleaseYearFromChange,
  releaseYearTo,
  onReleaseYearToChange,
  localPlayersMin,
  onLocalPlayersMinChange,
  onlineMultiplayerOnly,
  onOnlineMultiplayerOnlyChange,
  coopOnly,
  onCoopOnlyChange,
  timeToBeat,
  onTimeToBeatChange,
  ratingMin,
  onRatingMinChange,
  open,
  onClose,
  hiddenFields,
}: GameFilterDialogProps) => {
  const { t } = useTranslation();
  const shown = (field: GameFilterFieldKey) => !hiddenFields?.has(field);
  const allPlaceholder = t("games.listToolbar.allOption");
  const selectedTags = tagOptions.filter((tag) => tagIds.includes(tag.id));
  const selectedPlatforms = platformOptions.filter((platform) => platformKeys.includes(platform.id));
  const selectedGenres = genreOptions.filter((genre) => genreIds.includes(genre.id));
  const selectedReleaseStatuses = RELEASE_STATUS_OPTIONS.filter((option) => releaseStatuses.includes(option.value));
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
  const showStorefrontFilter = formats.includes("digital");
  const hasActiveFilters =
    countActiveFilters({
      ownershipStatuses,
      platformKeys,
      tagIds,
      collectionIds,
      franchiseIds,
      gameTypes,
      formats,
      storefronts,
      playStatuses,
      sources,
      steelbookOnly,
      genreIds,
      releaseStatuses,
      releaseYearFrom,
      releaseYearTo,
      localPlayersMin,
      onlineMultiplayerOnly,
      coopOnly,
      timeToBeat,
      ratingMin,
    }) > 0;


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
    onPlatformKeysChange([]);
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
    onGenreIdsChange([]);
    onGenreExcludeChange(false);
    onReleaseStatusesChange([]);
    onReleaseYearFromChange(null);
    onReleaseYearToChange(null);
    onLocalPlayersMinChange(null);
    onOnlineMultiplayerOnlyChange(false);
    onCoopOnlyChange(false);
    onTimeToBeatChange(null);
    onRatingMinChange(null);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t("games.listView.filterTitle")}</DialogTitle>
      <DialogContent>
      <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {!hideGameTypesField && shown("gameType") ? (
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
          {shown("tag") ? (
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
          ) : null}
          {shown("ownership") ? (
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
          ) : null}
          {shown("playStatus") ? (
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
          ) : null}
          {!hidePlatformsField && shown("platform") ? (
          <Grid size={{ xs: 12, sm: 6 }}>
            <Stack spacing={0.5}>
              <AutocompleteMultiSelect<PlatformFilterOption>
                label={t("games.listToolbar.consoleLabel")}
                options={platformOptions}
                value={selectedPlatforms}
                onChange={(newValue) =>
                  onPlatformKeysChange(newValue.map((platform) => platform.id))
                }
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, val) => option.id === val.id}
                placeholder={allPlaceholder}
                fullWidth
              />
              <FilterFieldOptions
                selectedCount={platformKeys.length}
                exclude={platformExclude}
                onExcludeChange={onPlatformExcludeChange}
                {...matchAllProps("platform")}
              />
            </Stack>
          </Grid>
          ) : null}
          {shown("format") ? (
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
          ) : null}
          {showStorefrontFilter && shown("format") ? (
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
          {onSteelbookOnlyChange && shown("steelbook") ? (
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
          {!hideCollectionsField && shown("collection") ? (
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
          {!hideFranchisesField && shown("series") ? (
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
          {onSourcesChange && shown("source") ? (
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
          {shown("genre") ? (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Stack spacing={0.5}>
                <AutocompleteMultiSelect<GenreSummary>
                  label={t("games.listToolbar.genreLabel")}
                  options={genreOptions}
                  value={selectedGenres}
                  onChange={(newValue) => onGenreIdsChange(newValue.map((genre) => genre.id))}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, val) => option.id === val.id}
                  placeholder={allPlaceholder}
                  fullWidth
                />
                <FilterFieldOptions
                  selectedCount={genreIds.length}
                  exclude={genreExclude}
                  onExcludeChange={onGenreExcludeChange}
                  {...matchAllProps("genre")}
                />
              </Stack>
            </Grid>
          ) : null}
          {shown("release") ? (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Stack spacing={1.5}>
                {/* No Exclude/All row: a game is either out or not, so "not released" is
                    already the other option. */}
                <AutocompleteMultiSelect<ReleaseStatusOption>
                  label={t("games.listToolbar.releaseStatusLabel")}
                  options={RELEASE_STATUS_OPTIONS}
                  value={selectedReleaseStatuses}
                  onChange={(newValue) => onReleaseStatusesChange(newValue.map((option) => option.value))}
                  getOptionLabel={(option) => t(option.labelKey)}
                  isOptionEqualToValue={(option, val) => option.value === val.value}
                  placeholder={allPlaceholder}
                  fullWidth
                />
                <Stack direction="row" spacing={1}>
                  <TextField
                    label={t("games.listToolbar.releaseYearFromLabel")}
                    type="number"
                    value={releaseYearFrom ?? ""}
                    onChange={(event) => onReleaseYearFromChange(event.target.value ? Number(event.target.value) : null)}
                    slotProps={{ htmlInput: { min: 1950, max: 2100 } }}
                    fullWidth
                  />
                  <TextField
                    label={t("games.listToolbar.releaseYearToLabel")}
                    type="number"
                    value={releaseYearTo ?? ""}
                    onChange={(event) => onReleaseYearToChange(event.target.value ? Number(event.target.value) : null)}
                    slotProps={{ htmlInput: { min: 1950, max: 2100 } }}
                    fullWidth
                  />
                </Stack>
              </Stack>
            </Grid>
          ) : null}
          {shown("localPlayers") ? (
            <Grid size={{ xs: 12, sm: 6 }}>
              <AutocompleteSelect<number>
                label={t("games.listToolbar.localPlayersLabel")}
                options={LOCAL_PLAYERS_OPTIONS}
                value={localPlayersMin}
                onChange={onLocalPlayersMinChange}
                getOptionLabel={(option) => t("games.listToolbar.localPlayersOption", { count: option })}
                placeholder={allPlaceholder}
                fullWidth
              />
            </Grid>
          ) : null}
          {shown("timeToBeat") ? (
            <Grid size={{ xs: 12, sm: 6 }}>
              <AutocompleteSelect<TimeToBeatOption>
                label={t("games.listToolbar.timeToBeatLabel")}
                options={TIME_TO_BEAT_OPTIONS}
                value={TIME_TO_BEAT_OPTIONS.find((option) => option.value === timeToBeat) ?? null}
                onChange={(option) => onTimeToBeatChange(option?.value ?? null)}
                getOptionLabel={(option) => timeToBeatLabel(option, t)}
                isOptionEqualToValue={(option, val) => option.value === val.value}
                placeholder={allPlaceholder}
                fullWidth
              />
            </Grid>
          ) : null}
          {shown("rating") ? (
            <Grid size={{ xs: 12, sm: 6 }}>
              <AutocompleteSelect<number>
                label={t("games.listToolbar.ratingLabel")}
                options={RATING_OPTIONS}
                value={ratingMin}
                onChange={onRatingMinChange}
                getOptionLabel={(option) => t("games.listToolbar.ratingOption", { min: option / 10 })}
                placeholder={allPlaceholder}
                fullWidth
              />
            </Grid>
          ) : null}
          {shown("onlineMultiplayer") || shown("coop") ? (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Stack>
                {shown("onlineMultiplayer") ? (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={onlineMultiplayerOnly}
                        onChange={(event) => onOnlineMultiplayerOnlyChange(event.target.checked)}
                      />
                    }
                    label={t("games.listToolbar.onlineMultiplayerOnlyLabel")}
                  />
                ) : null}
                {shown("coop") ? (
                  <FormControlLabel
                    control={<Switch checked={coopOnly} onChange={(event) => onCoopOnlyChange(event.target.checked)} />}
                    label={t("games.listToolbar.coopOnlyLabel")}
                  />
                ) : null}
              </Stack>
            </Grid>
          ) : null}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClearFilters} disabled={!hasActiveFilters}>
          {t("games.listToolbar.clearFiltersButton")}
        </Button>
        <Button onClick={onClose} variant="contained">
          {t("common.close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GameFilterDialog;
