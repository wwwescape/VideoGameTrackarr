import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";

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
}

// Multi-select sibling of AutocompleteSelect — same visual shape, MUI's built-in `multiple`
// mode renders each selected option as an inline chip in the field itself, so callers don't
// need a separate "active filters" row to show/clear a multi-value selection.
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
      renderInput={(params) => <TextField {...params} label={label} placeholder={value.length ? undefined : placeholder} />}
    />
  );
}

export default AutocompleteMultiSelect;
