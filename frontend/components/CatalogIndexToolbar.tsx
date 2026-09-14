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
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { CatalogSortOption } from "../api/types";
import AutocompleteSelect from "./AutocompleteSelect";

interface SortOption {
  value: CatalogSortOption;
  labelKey: string;
}

const SORT_OPTIONS: SortOption[] = [
  { value: "name_asc", labelKey: "games.listToolbar.sortNameAsc" },
  { value: "name_desc", labelKey: "games.listToolbar.sortNameDesc" },
];

interface CatalogIndexToolbarProps {
  searchLabel: string;
  searchPlaceholder: string;
  searchKeyword: string;
  onSearchKeywordChange: (value: string) => void;
  sort: CatalogSortOption;
  onSortChange: (value: CatalogSortOption) => void;
}

// Trimmed sibling of GameListToolbar's Filters & Sort dialog — Collections/Series are just a
// name + game count each, so there's nothing to filter (the Filter tab says so plainly) and
// Sort only ever offers Name ASC/DESC. No selection-mode toggle either, since these index
// pages have no bulk actions.
const CatalogIndexToolbar = ({
  searchLabel,
  searchPlaceholder,
  searchKeyword,
  onSearchKeywordChange,
  sort,
  onSortChange,
}: CatalogIndexToolbarProps) => {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"filter" | "more">("filter");
  const selectedSortOption =
    SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, mb: 3 }}>
      <Stack direction="row" spacing={1}>
        <TextField
          label={searchLabel}
          variant="outlined"
          value={searchKeyword}
          onChange={(event) => onSearchKeywordChange(event.target.value)}
          placeholder={searchPlaceholder}
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
            onClick={() => setDialogOpen(true)}
            aria-label={t("games.listToolbar.filtersButtonLabel")}
            sx={{ alignSelf: "center" }}
          >
            <FilterListIcon />
          </IconButton>
        </Tooltip>
      </Stack>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
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
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {t("games.listToolbar.noFiltersAvailable")}
            </Typography>
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
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} variant="contained">
            {t("common.close")}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default CatalogIndexToolbar;
