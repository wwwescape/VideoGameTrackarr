import { useState } from "react";
import ClearIcon from "@mui/icons-material/Clear";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { GameSortOption } from "../api/types";
import { GAME_SORT_OPTIONS, type GameSortOptionItem } from "../utils/gameSortOptions";
import AutocompleteSelect from "./AutocompleteSelect";

interface PublicGamesToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: GameSortOption;
  onSortChange: (value: GameSortOption) => void;
}

// A trimmed-down GameListToolbar for the read-only share page: search plus a Filter & Sort
// dialog whose Filter tab is empty for now — the public endpoint exposes no filter
// dimensions (platforms, tags, etc. aren't part of the public payload).
const PublicGamesToolbar = ({ search, onSearchChange, sort, onSortChange }: PublicGamesToolbarProps) => {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"filter" | "sort">("filter");

  const selectedSortOption =
    GAME_SORT_OPTIONS.find((option) => option.value === sort) ?? GAME_SORT_OPTIONS[0];

  return (
    <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
      <TextField
        label={t("public.games.searchLabel")}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: search && (
              <InputAdornment position="end" onClick={() => onSearchChange("")}>
                <ClearIcon style={{ cursor: "pointer" }} />
              </InputAdornment>
            ),
          },
        }}
      />
      <Tooltip title={t("public.games.filtersButtonLabel")}>
        <IconButton
          onClick={() => setDialogOpen(true)}
          aria-label={t("public.games.filtersButtonLabel")}
          sx={{ alignSelf: "center" }}
        >
          <FilterListIcon />
        </IconButton>
      </Tooltip>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("public.games.filtersButtonLabel")}</DialogTitle>
        <Tabs value={activeTab} onChange={(_event, value) => setActiveTab(value)} variant="fullWidth">
          <Tab value="filter" label={t("games.listToolbar.filterTabLabel")} />
          <Tab value="sort" label={t("public.games.sortTabLabel")} />
        </Tabs>
        <DialogContent>
          {activeTab === "filter" ? (
            <Typography color="text.secondary" sx={{ mt: 1.5, textAlign: "center" }}>
              {t("public.games.noFiltersAvailable")}
            </Typography>
          ) : (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12 }}>
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
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} variant="contained">
            {t("common.close")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default PublicGamesToolbar;
