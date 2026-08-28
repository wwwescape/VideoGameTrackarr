import { useState } from "react";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import ClearIcon from "@mui/icons-material/Clear";
import CloseIcon from "@mui/icons-material/Close";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import DeleteIcon from "@mui/icons-material/Delete";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { CatalogRefSummary, PlatformResponse, Tag } from "../api/types";
import AutocompleteMultiSelect from "./AutocompleteMultiSelect";
import AutocompleteSelect from "./AutocompleteSelect";
import TagChip from "./TagChip";

function platformOptionLabel(option: PlatformResponse): string {
  return option.abbreviation ? `${option.name} (${option.abbreviation})` : option.name;
}

export type GameFilter = "all" | "owned" | "wishlist";

const FILTER_OPTIONS: { value: GameFilter; labelKey: string }[] = [
  { value: "all", labelKey: "games.listToolbar.filterAll" },
  { value: "owned", labelKey: "games.listToolbar.filterOwned" },
  { value: "wishlist", labelKey: "games.listToolbar.filterWishlist" },
];

interface GameListToolbarProps {
  searchKeyword: string;
  onSearchKeywordChange: (value: string) => void;
  filter: GameFilter;
  onFilterChange: (filter: GameFilter) => void;
  selectionMode: boolean;
  selectedCount: number;
  visibleCount: number;
  onEnterSelectionMode: () => void;
  onExitSelectionMode: () => void;
  onSelectAllVisible: () => void;
  onBulkDelete: () => void;
  onCompare: () => void;
  platformOptions: PlatformResponse[];
  platformIds: number[];
  onPlatformIdsChange: (value: number[]) => void;
  tagOptions: Tag[];
  tagIds: number[];
  onTagIdsChange: (value: number[]) => void;
  collectionOptions: CatalogRefSummary[];
  collectionId: number | "";
  onCollectionChange: (value: number | "") => void;
  franchiseOptions: CatalogRefSummary[];
  franchiseId: number | "";
  onFranchiseChange: (value: number | "") => void;
}

// Sticky-feeling toolbar (rendered once, above the virtualized grid) that swaps between
// two rows depending on mode: search + instant filter chips normally, or a contextual
// selection action bar once the user has entered bulk-select mode.
const GameListToolbar = ({
  searchKeyword,
  onSearchKeywordChange,
  filter,
  onFilterChange,
  selectionMode,
  selectedCount,
  visibleCount,
  onEnterSelectionMode,
  onExitSelectionMode,
  onSelectAllVisible,
  onBulkDelete,
  onCompare,
  platformOptions,
  platformIds,
  onPlatformIdsChange,
  tagOptions,
  tagIds,
  onTagIdsChange,
  collectionOptions,
  collectionId,
  onCollectionChange,
  franchiseOptions,
  franchiseId,
  onFranchiseChange,
}: GameListToolbarProps) => {
  const { t } = useTranslation();
  const allPlaceholder = t("games.listToolbar.allOption");
  const selectedTags = tagOptions.filter((tag) => tagIds.includes(tag.id));
  const selectedPlatforms = platformOptions.filter((platform) => platformIds.includes(platform.id));
  const activeFilterCount =
    platformIds.length + tagIds.length + (collectionId ? 1 : 0) + (franchiseId ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  const [filtersAnchorEl, setFiltersAnchorEl] = useState<HTMLButtonElement | null>(null);
  const filtersOpen = Boolean(filtersAnchorEl);

  const handleClearFilters = () => {
    onPlatformIdsChange([]);
    onTagIdsChange([]);
    onCollectionChange("");
    onFranchiseChange("");
  };

  if (selectionMode) {
    return (
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <IconButton onClick={onExitSelectionMode} aria-label={t("games.listToolbar.exitSelectionModeAriaLabel")}>
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
            variant="outlined"
            startIcon={<CompareArrowsIcon />}
            disabled={selectedCount < 2}
            onClick={onCompare}
          >
            {t("games.listToolbar.compareButton")}
          </Button>
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
              onClick={(event) => setFiltersAnchorEl(event.currentTarget)}
              aria-label={t("games.listToolbar.filtersButtonLabel")}
              sx={{ alignSelf: "center" }}
            >
              <Badge badgeContent={activeFilterCount} color="primary">
                <FilterListIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title={t("games.listToolbar.selectGames")}>
            <IconButton
              onClick={onEnterSelectionMode}
              aria-label={t("games.listToolbar.selectGames")}
              sx={{ alignSelf: "center" }}
            >
              <CheckBoxOutlineBlankIcon />
            </IconButton>
          </Tooltip>
        </Stack>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {FILTER_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={t(option.labelKey)}
              color={filter === option.value ? "primary" : "default"}
              variant={filter === option.value ? "filled" : "outlined"}
              onClick={() => onFilterChange(option.value)}
            />
          ))}
        </Box>
        <Popover
          open={filtersOpen}
          anchorEl={filtersAnchorEl}
          onClose={() => setFiltersAnchorEl(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          <Stack spacing={2} sx={{ p: 2, width: 280 }}>
            <AutocompleteMultiSelect<PlatformResponse>
              label={t("games.listToolbar.consoleLabel")}
              options={platformOptions}
              value={selectedPlatforms}
              onChange={(newValue) => onPlatformIdsChange(newValue.map((platform) => platform.id))}
              getOptionLabel={platformOptionLabel}
              isOptionEqualToValue={(option, val) => option.id === val.id}
              placeholder={allPlaceholder}
              fullWidth
            />
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
            <AutocompleteSelect<CatalogRefSummary>
              label={t("games.listToolbar.collectionLabel")}
              options={collectionOptions}
              value={collectionOptions.find((option) => option.id === collectionId) ?? null}
              onChange={(newValue) => onCollectionChange(newValue ? newValue.id : "")}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, val) => option.id === val.id}
              placeholder={allPlaceholder}
              fullWidth
            />
            <AutocompleteSelect<CatalogRefSummary>
              label={t("games.listToolbar.seriesLabel")}
              options={franchiseOptions}
              value={franchiseOptions.find((option) => option.id === franchiseId) ?? null}
              onChange={(newValue) => onFranchiseChange(newValue ? newValue.id : "")}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, val) => option.id === val.id}
              placeholder={allPlaceholder}
              fullWidth
            />
            <Button onClick={handleClearFilters} disabled={!hasActiveFilters}>
              {t("games.listToolbar.clearFiltersButton")}
            </Button>
          </Stack>
        </Popover>
      </Stack>
    </Paper>
  );
};

export default GameListToolbar;
