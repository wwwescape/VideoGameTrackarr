import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { createFilterOptions } from "@mui/material/useAutocomplete";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

interface TouchPickerSheetProps<T> {
  open: boolean;
  onClose: () => void;
  label: string;
  options: T[];
  getOptionLabel: (option: T) => string;
  isSelected: (option: T) => boolean;
  // Multi picker: each tap toggles an option, applied right away; Done closes the sheet.
  multiple?: boolean;
  onToggle?: (option: T) => void;
  // Single picker: a tap picks the option and closes the sheet.
  onPick?: (option: T | null) => void;
  // Single picker's first row, which clears the value (the field's placeholder); none when null.
  clearLabel?: string | null;
}

// The touch screen side of AutocompleteSelect / AutocompleteMultiSelect: the usual mobile
// picker sheet, full screen on phones and a dialog on tablets. Nothing is focused when it opens,
// so the keyboard only comes up once the search box is tapped; the search matches like the
// desktop Autocomplete's.
function TouchPickerSheet<T>({
  open,
  onClose,
  label,
  options,
  getOptionLabel,
  isSelected,
  multiple,
  onToggle,
  onPick,
  clearLabel,
}: TouchPickerSheetProps<T>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
  const [search, setSearch] = useState("");
  const filterOptions = useMemo(() => createFilterOptions<T>(), []);
  const shown = useMemo(
    () => filterOptions(options, { inputValue: search, getOptionLabel }),
    [filterOptions, options, search, getOptionLabel],
  );

  const pick = (option: T | null) => {
    onPick?.(option);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={phone}
      fullWidth
      maxWidth="sm"
      slotProps={{ transition: { onExited: () => setSearch("") } }}
    >
      <DialogTitle>{label}</DialogTitle>
      <DialogContent dividers sx={{ px: 0, pt: 0, display: "flex", flexDirection: "column" }}>
        <TextField
          type="search"
          size="small"
          placeholder={t("common.search")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ mx: 2, my: 1.5 }}
          slotProps={{ htmlInput: { "aria-label": t("common.search") } }}
        />
        <List dense sx={{ overflowY: "auto", flex: 1 }}>
          {!multiple && clearLabel != null && !search ? (
            <ListItemButton onClick={() => pick(null)}>
              <ListItemText primary={clearLabel} slotProps={{ primary: { color: "text.secondary" } }} />
            </ListItemButton>
          ) : null}
          {shown.map((option, index) => {
            const selected = isSelected(option);
            return (
              <ListItemButton
                key={index}
                selected={!multiple && selected}
                onClick={() => (multiple ? onToggle?.(option) : pick(option))}
              >
                {multiple ? (
                  <ListItemIcon sx={{ minWidth: 0, mr: 1 }}>
                    <Checkbox edge="start" size="small" checked={selected} tabIndex={-1} disableRipple sx={{ py: 0 }} />
                  </ListItemIcon>
                ) : null}
                <ListItemText primary={getOptionLabel(option)} />
              </ListItemButton>
            );
          })}
          {shown.length === 0 ? (
            <Typography color="text.secondary" sx={{ px: 2, py: 1 }}>
              {t("common.noOptions")}
            </Typography>
          ) : null}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{multiple ? t("common.done") : t("common.close")}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default TouchPickerSheet;
