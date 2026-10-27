import Autocomplete from "@mui/material/Autocomplete";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useTouchScreen } from "../hooks/useTouchScreen";

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
// On a touch screen it falls back to that plain select: an Autocomplete focuses its text input
// on every tap, which raises the on-screen keyboard over the list. Unless disableClearable, the
// list starts with the placeholder (or a dash), which clears the value like the Autocomplete's
// clear button; an empty field just shows its label, as the Autocomplete's does.
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

  if (touchScreen) {
    // The select works on option indexes: options are objects, and its value must be a primitive.
    const selectedIndex =
      value === null
        ? -1
        : options.findIndex((option) => (isOptionEqualToValue ? isOptionEqualToValue(option, value) : option === value));
    return (
      <TextField
        select
        label={label}
        value={selectedIndex >= 0 ? selectedIndex : ""}
        onChange={(event) => {
          const index = event.target.value as unknown as number | "";
          onChange(index === "" ? null : options[index]);
        }}
        disabled={disabled}
        required={required}
        fullWidth={fullWidth}
        helperText={helperText}
        sx={sx}
        slotProps={{
          select: { renderValue: (index) => getOptionLabel(options[index as number]) },
        }}
      >
        {!disableClearable ? <MenuItem value="">{placeholder ?? "—"}</MenuItem> : null}
        {options.map((option, index) => (
          <MenuItem key={index} value={index}>
            {getOptionLabel(option)}
          </MenuItem>
        ))}
      </TextField>
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
