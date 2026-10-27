import type { ReactNode } from "react";
import CheckIcon from "@mui/icons-material/Check";
import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Slider from "@mui/material/Slider";
import TableCell, { type TableCellProps } from "@mui/material/TableCell";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";
import type { ListSort } from "../utils/listSort";
import { CARD_SIZE_MAX, CARD_SIZE_MIN } from "./GameListViews";

// Building blocks for a list page's toolbar, shared by the game lists (GameListControls), the
// Collections/Series/Platforms index pages and Hardware.

interface ListSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}

// The search field beside the breadcrumbs (Page's `actions`).
export function ListSearchField({ value, onChange, label, placeholder }: ListSearchFieldProps) {
  const { t } = useTranslation();
  return (
    <TextField
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      sx={{ width: { xs: "100%", sm: 280 } }}
      slotProps={{
        htmlInput: { "aria-label": label },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" sx={{ color: "vgt.text3" }} />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" edge="end" onClick={() => onChange("")} aria-label={t("games.listView.clearSearch")}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        },
      }}
    />
  );
}

interface ChoiceMenuItemProps {
  label: ReactNode;
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
}

// A menu row with a check on the current choice.
export function ChoiceMenuItem({ label, selected, onClick, icon }: ChoiceMenuItemProps) {
  return (
    <MenuItem selected={selected} onClick={onClick}>
      {icon ? <ListItemIcon>{icon}</ListItemIcon> : null}
      <ListItemText>{label}</ListItemText>
      {selected ? <CheckIcon fontSize="small" color="primary" sx={{ ml: 2 }} /> : null}
    </MenuItem>
  );
}

export interface MenuChoice<V extends string> {
  value: V;
  label: string;
  icon?: ReactNode;
}

interface ChoiceMenuProps<V extends string> {
  anchor: HTMLElement | null;
  onClose: () => void;
  choices: MenuChoice<V>[];
  selected: V;
  onSelect: (value: V) => void;
}

// A View or Sort menu: pick one, and the menu closes.
export function ChoiceMenu<V extends string>({ anchor, onClose, choices, selected, onSelect }: ChoiceMenuProps<V>) {
  return (
    <Menu anchorEl={anchor} open={!!anchor} onClose={onClose}>
      {choices.map((choice) => (
        <ChoiceMenuItem
          key={choice.value}
          label={choice.label}
          icon={choice.icon}
          selected={choice.value === selected}
          onClick={() => {
            onSelect(choice.value);
            onClose();
          }}
        />
      ))}
    </Menu>
  );
}

interface SortHeaderCellProps<F extends string> extends Omit<TableCellProps, "onClick"> {
  field: F;
  sort: ListSort<F>;
  onSort: (field: F) => void;
}

// A table column header that sorts the list by its column: active with an arrow while it's the
// sort, and clicking it again flips the direction (see nextListSort).
export function SortHeaderCell<F extends string>({ field, sort, onSort, children, ...cellProps }: SortHeaderCellProps<F>) {
  const active = sort.field === field;
  return (
    <TableCell {...cellProps} aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
      <TableSortLabel active={active} direction={active ? sort.direction : "asc"} onClick={() => onSort(field)}>
        {children}
      </TableSortLabel>
    </TableCell>
  );
}

interface SortMenuProps<F extends string> {
  anchor: HTMLElement | null;
  onClose: () => void;
  fields: MenuChoice<F>[];
  field: F;
  direction: "asc" | "desc";
  onFieldChange: (field: F) => void;
  onDirectionChange: (direction: "asc" | "desc") => void;
}

// A Sort menu: what to sort by, then Ascending or Descending. Either pick closes it.
export function SortMenu<F extends string>({
  anchor,
  onClose,
  fields,
  field,
  direction,
  onFieldChange,
  onDirectionChange,
}: SortMenuProps<F>) {
  const { t } = useTranslation();
  const pick = (apply: () => void) => () => {
    apply();
    onClose();
  };
  return (
    <Menu anchorEl={anchor} open={!!anchor} onClose={onClose}>
      {fields.map((choice) => (
        <ChoiceMenuItem
          key={choice.value}
          label={choice.label}
          selected={choice.value === field}
          onClick={pick(() => onFieldChange(choice.value))}
        />
      ))}
      <Divider />
      <ChoiceMenuItem
        label={t("games.listView.sortAscending")}
        selected={direction === "asc"}
        onClick={pick(() => onDirectionChange("asc"))}
      />
      <ChoiceMenuItem
        label={t("games.listView.sortDescending")}
        selected={direction === "desc"}
        onClick={pick(() => onDirectionChange("desc"))}
      />
    </Menu>
  );
}

interface CardSizeSliderProps {
  value: number;
  onChange: (value: number) => void;
  // Only the card views use it.
  disabled?: boolean;
}

// The Options menu's card size.
export function CardSizeSlider({ value, onChange, disabled }: CardSizeSliderProps) {
  const { t } = useTranslation();
  return (
    <Box sx={{ px: 2, pt: 1, pb: 1.5, width: 260 }}>
      <Box id="card-size-label" sx={{ typography: "overline", color: "vgt.text3" }}>
        {t("games.listView.cardSize")}
      </Box>
      <Slider
        value={value}
        min={CARD_SIZE_MIN}
        max={CARD_SIZE_MAX}
        step={10}
        onChange={(_event, next) => onChange(next as number)}
        aria-labelledby="card-size-label"
        valueLabelDisplay="auto"
        valueLabelFormat={(size) => `${size}px`}
        disabled={disabled}
      />
    </Box>
  );
}
