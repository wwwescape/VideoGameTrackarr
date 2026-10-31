import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { useTouchScreen } from "../hooks/useTouchScreen";
import TouchPickerSheet from "./TouchPickerSheet";

interface AutocompleteSelectProps<T> {
  label: string;
  options: T[];
  value: T | null;
  onChange: (value: T | null) => void;
  getOptionLabel: (option: T) => string;
  isOptionEqualToValue?: (option: T, value: T) => boolean;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  helperText?: string;
  placeholder?: string;
  disableClearable?: boolean;
  sx?: object;
}

// Type-to-filter replacement for the `<TextField select><MenuItem>` dropdown pattern — the
// non-freeSolo sibling of FreeSoloLookupField (picks an existing option only, no typing in
// a new value).
//
// On a touch screen, tapping the field opens a picker sheet instead (TouchPickerSheet): an
// Autocomplete focuses its text input on every tap, which raises the on-screen keyboard over the
// list. Unless disableClearable, the sheet's list starts with the placeholder (or a dash), which
// clears the value like the Autocomplete's clear button; an empty field just shows its label, as
// the Autocomplete's does.
function AutocompleteSelect<T>({
  label,
  options,
  value,
  onChange,
  getOptionLabel,
  isOptionEqualToValue,
  disabled,
  required,
  fullWidth,
  helperText,
  placeholder,
  disableClearable,
  sx,
}: AutocompleteSelectProps<T>) {
  const touchScreen = useTouchScreen();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (touchScreen) {
    const isSelected = (option: T) =>
      value !== null && (isOptionEqualToValue ? isOptionEqualToValue(option, value) : option === value);
    return (
      <>
        {/* A select that never opens its own menu: it renders no text input (so no keyboard), and
            shows the value straight from `value`, even one that isn't in the options yet. */}
        <TextField
          select
          label={label}
          value={value === null ? [] : [0]}
          disabled={disabled}
          required={required}
          fullWidth={fullWidth}
          helperText={helperText}
          sx={sx}
          slotProps={{
            select: {
              multiple: true,
              open: false,
              onOpen: () => setSheetOpen(true),
              renderValue: () => (value === null ? "" : getOptionLabel(value)),
            },
          }}
        />
        <TouchPickerSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          label={label}
          options={options}
          getOptionLabel={getOptionLabel}
          isSelected={isSelected}
          onPick={onChange}
          clearLabel={disableClearable ? null : (placeholder ?? "—")}
        />
      </>
    );
  }

  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={(_event, newValue) => onChange(newValue)}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={isOptionEqualToValue}
      disabled={disabled}
      fullWidth={fullWidth}
      disableClearable={disableClearable}
      sx={sx}
      renderInput={(params) => (
        <TextField {...params} label={label} required={required} helperText={helperText} placeholder={placeholder} />
      )}
    />
  );
}

export default AutocompleteSelect;
