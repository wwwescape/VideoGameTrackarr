import type { ReactNode } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import type { AutocompleteGetItemProps } from "@mui/material/useAutocomplete";
import { useTouchScreen } from "../hooks/useTouchScreen";

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
//
// On a touch screen it's a plain select with checkboxes instead: an Autocomplete focuses its
// text input on every tap, which raises the on-screen keyboard over the list. The same chips
// (and the caller's renderValue) show the selection, each still removable from its cross; the
// label sits in the empty field, as the Autocomplete's does, so the placeholder isn't needed.
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
  const touchScreen = useTouchScreen();

  if (touchScreen) {
    const isSelected = (option: T) =>
      value.some((selected) => (isOptionEqualToValue ? isOptionEqualToValue(option, selected) : option === selected));
    // The select works on option indexes: options are objects, and its value must be a primitive.
    const selectedIndexes = options.flatMap((option, index) => (isSelected(option) ? [index] : []));
    const remove = (index: number) => onChange(value.filter((_selected, valueIndex) => valueIndex !== index));
    const getItemProps = (({ index }: { index: number }) => ({
      key: index,
      tabIndex: -1,
      "data-item-index": index,
      onDelete: () => remove(index),
      // The chips sit inside the select, which would otherwise open on the cross's mousedown.
      onMouseDown: (event: { stopPropagation: () => void }) => event.stopPropagation(),
    })) as unknown as AutocompleteGetItemProps<true>;

    return (
      <TextField
        select
        label={label}
        value={selectedIndexes}
        onChange={(event) => {
          const indexes = event.target.value as unknown as number[];
          onChange(indexes.map((index) => options[index]));
        }}
        disabled={disabled}
        fullWidth={fullWidth}
        sx={sx}
        slotProps={{
          select: {
            multiple: true,
            renderValue: () => (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {renderValue
                  ? renderValue(value, getItemProps)
                  : value.map((option, index) => {
                      const { key, ...itemProps } = getItemProps({ index });
                      return <Chip key={key} size="small" label={getOptionLabel(option)} {...itemProps} />;
                    })}
              </Box>
            ),
          },
        }}
      >
        {options.map((option, index) => (
          <MenuItem key={index} value={index}>
            <Checkbox size="small" checked={selectedIndexes.includes(index)} sx={{ py: 0, pl: 0 }} />
            <ListItemText primary={getOptionLabel(option)} />
          </MenuItem>
        ))}
      </TextField>
    );
  }

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
