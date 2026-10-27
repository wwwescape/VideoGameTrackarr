import { useState, type ReactNode } from "react";
import CancelIcon from "@mui/icons-material/Cancel";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import SortIcon from "@mui/icons-material/Sort";
import TuneIcon from "@mui/icons-material/Tune";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Menu from "@mui/material/Menu";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useTranslation } from "react-i18next";
import type { ListSortControl } from "../hooks/useListSort";
import { CardSizeSlider, ChoiceMenu, SortMenu, type MenuChoice } from "./ListControls";
import { ToolbarButton } from "./Page";

// The Options · View · Sort · Filter toolbar for the smaller list pages (On Sale, Events,
// Orphaned accessories, the Collections/Series/Platforms index, Add Game), in the same order
// and with the same menus as the Games list (GameListControls) and Hardware. Pass only the
// parts a page has; each manages its own menu.

interface ListToolbarProps<V extends string, S extends string> {
  cardSize?: { value: number; onChange: (value: number) => void; disabled?: boolean };
  view?: { value: V; choices: MenuChoice<V>[]; onChange: (value: V) => void };
  // A field + direction Sort menu (useListSort); a table on the page shares the same control.
  sort?: ListSortControl<S>;
  // How many filters are in use (the badge), and what opens the page's FilterDialog.
  filter?: { count: number; onOpen: () => void };
}

export function ListToolbar<V extends string = string, S extends string = string>({
  cardSize,
  view,
  sort,
  filter,
}: ListToolbarProps<V, S>) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<{
    name: "options" | "view" | "sort";
    anchor: HTMLElement;
  } | null>(null);
  const closeMenu = () => setMenu(null);
  const currentView = view?.choices.find((choice) => choice.value === view.value);

  return (
    <>
      {cardSize ? (
        <ToolbarButton
          icon={<TuneIcon />}
          label={t("games.listView.options")}
          onClick={(event) => setMenu({ name: "options", anchor: event.currentTarget })}
          aria-haspopup="menu"
        />
      ) : null}
      {view ? (
        <ToolbarButton
          icon={currentView?.icon ?? view.choices[0]?.icon}
          label={t("games.listView.view")}
          onClick={(event) => setMenu({ name: "view", anchor: event.currentTarget })}
          aria-haspopup="menu"
        />
      ) : null}
      {sort ? (
        <ToolbarButton
          icon={<SortIcon />}
          label={t("games.listView.sort")}
          onClick={(event) => setMenu({ name: "sort", anchor: event.currentTarget })}
          aria-haspopup="menu"
        />
      ) : null}
      {filter ? (
        <ToolbarButton
          icon={<FilterAltOutlinedIcon />}
          label={t("games.listView.filter")}
          count={filter.count}
          active={filter.count > 0}
          onClick={filter.onOpen}
        />
      ) : null}

      {cardSize ? (
        <Menu anchorEl={menu?.anchor} open={menu?.name === "options"} onClose={closeMenu}>
          <CardSizeSlider
            value={cardSize.value}
            onChange={cardSize.onChange}
            disabled={cardSize.disabled}
          />
        </Menu>
      ) : null}
      {view ? (
        <ChoiceMenu<V>
          anchor={menu?.name === "view" ? menu.anchor : null}
          onClose={closeMenu}
          choices={view.choices}
          selected={view.value}
          onSelect={view.onChange}
        />
      ) : null}
      {sort ? (
        <SortMenu<S>
          anchor={menu?.name === "sort" ? menu.anchor : null}
          onClose={closeMenu}
          fields={sort.fields.map((option) => ({ value: option.field, label: option.label }))}
          field={sort.sort.field}
          direction={sort.sort.direction}
          onFieldChange={sort.pickField}
          onDirectionChange={sort.setDirection}
        />
      ) : null}
    </>
  );
}

interface FilterDialogProps {
  open: boolean;
  onClose: () => void;
  onClear: () => void;
  // Disables Clear filters when nothing is filtered.
  activeCount: number;
  children: ReactNode;
}

// The Filter dialog's frame, as on the Games list and Hardware: fields, then Clear filters and
// Close. Filters apply as they change.
export function FilterDialog({ open, onClose, onClear, activeCount, children }: FilterDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("games.listView.filterTitle")}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "grid", gap: 2.5, pt: 1 }}>{children}</Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClear} disabled={activeCount === 0}>
          {t("games.listToolbar.clearFiltersButton")}
        </Button>
        <Button onClick={onClose} variant="contained">
          {t("common.close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface ToggleFilterProps<V extends string> {
  id: string;
  label: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (value: V) => void;
}

// One pick-one filter (All / Owned / …) as a row of toggle buttons, like Hardware's Status.
export function ToggleFilter<V extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: ToggleFilterProps<V>) {
  return (
    <Box>
      <Box id={`${id}-label`} sx={{ typography: "overline", color: "vgt.text3" }}>
        {label}
      </Box>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value}
        onChange={(_event, next: V | null) => next && onChange(next)}
        aria-labelledby={`${id}-label`}
        sx={{ flexWrap: "wrap" }}
      >
        {options.map((option) => (
          <ToggleButton
            key={option.value}
            value={option.value}
            sx={{ px: 2, textTransform: "none" }}
          >
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

// The filters in use, under the breadcrumbs, each removable on its own.
export function FilterChips({ chips }: { chips: FilterChip[] }) {
  const { t } = useTranslation();
  if (!chips.length) return null;
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: -0.5, mb: 1.75 }}>
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          size="small"
          label={chip.label}
          onDelete={chip.onRemove}
          deleteIcon={
            <CancelIcon aria-label={t("games.listView.removeFilter", { label: chip.label })} />
          }
        />
      ))}
    </Box>
  );
}
