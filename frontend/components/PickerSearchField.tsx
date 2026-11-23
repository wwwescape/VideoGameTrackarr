import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";

interface PickerSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  // Shows a spinner in place of the search icon while results load.
  fetching?: boolean;
}

// The add-on pickers' search box: a search icon (or spinner) at the start, and an × to clear it
// once something is typed.
const PickerSearchField = ({ value, onChange, fetching = false }: PickerSearchFieldProps) => {
  const { t } = useTranslation();
  return (
    <TextField
      size="small"
      fullWidth
      autoFocus
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={t("games.addonLinks.searchPlaceholder")}
      slotProps={{
        htmlInput: { "aria-label": t("games.addonLinks.searchLabel") },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              {fetching ? <CircularProgress size={16} /> : <SearchIcon fontSize="small" />}
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton
                size="small"
                edge="end"
                aria-label={t("games.addonLinks.clearSearch")}
                onClick={() => onChange("")}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
      sx={{ flexShrink: 0 }}
    />
  );
};

export default PickerSearchField;
