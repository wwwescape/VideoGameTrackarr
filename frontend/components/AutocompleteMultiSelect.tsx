import type { ReactNode } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import type { AutocompleteGetItemProps } from "@mui/material/useAutocomplete";

interface AutocompleteMultiSelectProps<T> {
  label: string;
  options: T[];
  value: T[];
  onChange: (value: T[]) => void;
  getOptionLabel: (option: T) => string;
  isOptionEqualToValue?: (option: T, value: T) => boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  placeholder?: string;
  sx?: object;
  renderValue?: (value: T[], getItemProps: AutocompleteGetItemProps<true>) => ReactNode;
}

// Multi-select sibling of AutocompleteSelect — same visual shape, MUI's built-in `multiple`
// mode renders each selected option as an inline chip in the field itself, so callers don't
// need a separate "active filters" row to show/clear a multi-value selection. `renderValue`
// is optional and forwarded as-is to MUI's Autocomplete — omitted, every existing caller
// (e.g. the Console/Platform filter) keeps MUI's default chip rendering unchanged.
function AutocompleteMultiSelect<T>({
  label,
  options,
  value,
  onChange,
  getOptionLabel,
  isOptionEqualToValue,
  disabled,
  fullWidth,
  placeholder,
  sx,
  renderValue,
}: AutocompleteMultiSelectProps<T>) {
  return (
    <Autocomplete
      multiple
      options={options}
      value={value}
      onChange={(_event, newValue) => onChange(newValue)}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={isOptionEqualToValue}
      disabled={disabled}
      fullWidth={fullWidth}
      sx={sx}
      renderValue={renderValue}
      renderInput={(params) => <TextField {...params} label={label} placeholder={value.length ? undefined : placeholder} />}
    />
  );
}

export default AutocompleteMultiSelect;
