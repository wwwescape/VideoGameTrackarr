import { type ReactNode, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import type { AutocompleteGetItemProps } from "@mui/material/useAutocomplete";
import { useTouchScreen } from "../hooks/useTouchScreen";
import TouchPickerSheet from "./TouchPickerSheet";

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
// On a touch screen, tapping the field opens a picker sheet with checkboxes instead
// (TouchPickerSheet): an Autocomplete focuses its text input on every tap, which raises the
// on-screen keyboard over the list. The same chips (and the caller's renderValue) show the
// selection, built from `value`, each still removable from its cross; the label sits in the empty
// field, as the Autocomplete's does, so the placeholder isn't needed.
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
  const [sheetOpen, setSheetOpen] = useState(false);

  if (touchScreen) {
    const matches = (option: T, selected: T) =>
      isOptionEqualToValue ? isOptionEqualToValue(option, selected) : option === selected;
    const isSelected = (option: T) => value.some((selected) => matches(option, selected));
    const toggle = (option: T) =>
      onChange(isSelected(option) ? value.filter((selected) => !matches(option, selected)) : [...value, option]);
    const remove = (index: number) => onChange(value.filter((_selected, valueIndex) => valueIndex !== index));
    const getItemProps = (({ index }: { index: number }) => ({
      key: index,
      tabIndex: -1,
      "data-item-index": index,
      onDelete: () => remove(index),
      // The chips sit inside the field, which would otherwise open the sheet on the cross's mousedown.
      onMouseDown: (event: { stopPropagation: () => void }) => event.stopPropagation(),
    })) as unknown as AutocompleteGetItemProps<true>;

    return (
      <>
        {/* A select that never opens its own menu: it renders no text input (so no keyboard). */}
        <TextField
          select
          label={label}
          value={value.map((_option, index) => index)}
          disabled={disabled}
          fullWidth={fullWidth}
          sx={sx}
          slotProps={{
            select: {
              multiple: true,
              open: false,
              onOpen: () => setSheetOpen(true),
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
        />
        <TouchPickerSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          label={label}
          options={options}
          getOptionLabel={getOptionLabel}
          isSelected={isSelected}
          multiple
          onToggle={toggle}
        />
      </>
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
