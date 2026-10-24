import { useRef, useState } from "react";
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
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import GameFilterDialog, { countActiveFilters, type GameFilterFieldsProps } from "./GameFilterDialog";

export type { OwnershipStatus } from "./GameFilterDialog";

interface GameListToolbarProps extends GameFilterFieldsProps {
  searchKeyword: string;
  onSearchKeywordChange: (value: string) => void;
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
}


// Sticky-feeling toolbar (rendered once, above the virtualized grid) that swaps between
// two rows depending on mode: search + a Filters & Sort button normally, or a contextual
// selection action bar once the user has entered bulk-select mode.
const GameListToolbar = ({
  searchKeyword,
  onSearchKeywordChange,
  selectionMode = false,
  selectedCount = 0,
  visibleCount = 0,
  onEnterSelectionMode,
  onExitSelectionMode = () => {},
  allVisibleSelected = false,
  onToggleSelectAll = () => {},
  onManageTagsClick,
  onBulkDelete = () => {},
  ...filterFields
}: GameListToolbarProps) => {
  const { t } = useTranslation();
  const activeFilterCount = countActiveFilters(filterFields);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // The Remove split button's dropdown (currently just "Tags") — anchored to the whole
  // ButtonGroup (via buttonGroupRef), not just the small arrow segment, so the menu below
  // can match its full width/left/right bounds instead of hugging the arrow alone.
  const [bulkActionsMenuOpen, setBulkActionsMenuOpen] = useState(false);
  const buttonGroupRef = useRef<HTMLDivElement>(null);

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
        <GameFilterDialog
          {...filterFields}
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
        />
      </Stack>
    </Paper>
  );
};

export default GameListToolbar;
