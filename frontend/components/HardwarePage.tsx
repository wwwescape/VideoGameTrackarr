import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import CancelIcon from "@mui/icons-material/Cancel";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import GridViewIcon from "@mui/icons-material/GridView";
import SortIcon from "@mui/icons-material/Sort";
import TableRowsIcon from "@mui/icons-material/TableRows";
import TuneIcon from "@mui/icons-material/Tune";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Menu from "@mui/material/Menu";
import { useTranslation } from "react-i18next";
import type { NamedLookup } from "../api/types";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useAccessoryTypes, useDeviceTypes, useHardwarePlatforms, useManufacturers } from "../hooks/useHardwareLookups";
import { useHardwareListState, type HardwareKindFilters, type HardwareSort } from "../hooks/useHardwareListState";
import { useLocalPreference } from "../hooks/useLocalPreference";
import AccessoryList from "./AccessoryList";
import DeviceList from "./DeviceList";
import { CARD_SIZE_DEFAULT } from "./GameListViews";
import HardwareFilterDialog, { type HardwareLookups } from "./HardwareFilterDialog";
import type { HardwareListView } from "./HardwareListViews";
import { CardSizeSlider, ChoiceMenu, ListSearchField } from "./ListControls";
import Page, { ToolbarButton } from "./Page";

const HardwarePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const state = useHardwareListState();
  const [view, setView] = useLocalPreference<HardwareListView>("hardware.view", "cards");
  const [cardSize, setCardSize] = useLocalPreference("hardware.cardSize", CARD_SIZE_DEFAULT);
  const [menu, setMenu] = useState<{ name: "options" | "view" | "sort"; anchor: HTMLElement } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: manufacturers } = useManufacturers();
  const { data: deviceTypes } = useDeviceTypes();
  const { data: accessoryTypes } = useAccessoryTypes();
  const { data: platforms } = useHardwarePlatforms();
  const lookups: HardwareLookups = {
    manufacturers: manufacturers ?? [],
    deviceTypes: deviceTypes ?? [],
    accessoryTypes: accessoryTypes ?? [],
    platforms: platforms ?? [],
  };

  const debouncedKeyword = useDebouncedValue(state.searchKeyword.trim(), 500);
  const closeMenu = () => setMenu(null);

  // Remove-one-value chips under the breadcrumbs, each named with its kind ("Devices: Sony").
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (state.status !== "all") {
    chips.push({
      key: "status",
      label: t(state.status === "owned" ? "hardware.detailsShared.statusOwned" : "hardware.detailsShared.statusWishlist"),
      onRemove: () => state.setStatus("all"),
    });
  }
  const addKindChips = (kind: string, heading: string, filters: HardwareKindFilters, typeOptions: NamedLookup[]) => {
    const add = (field: string, ids: number[], options: NamedLookup[], setIds: (ids: number[]) => void) =>
      ids.forEach((id) =>
        chips.push({
          key: `${kind}-${field}-${id}`,
          label: t("hardware.filter.kindChip", { kind: heading, label: options.find((option) => option.id === id)?.name ?? id }),
          onRemove: () => setIds(ids.filter((other) => other !== id)),
        })
      );
    add("manufacturer", filters.manufacturerIds, lookups.manufacturers, filters.setManufacturerIds);
    add("type", filters.typeIds, typeOptions, filters.setTypeIds);
    add("platform", filters.platformIds, lookups.platforms, filters.setPlatformIds);
  };
  addKindChips("devices", t("hardware.page.devicesHeading"), state.devices, lookups.deviceTypes);
  addKindChips("accessories", t("hardware.page.accessoriesHeading"), state.accessories, lookups.accessoryTypes);

  return (
    <Page
      toolbar={
        <>
          <ToolbarButton
            primary
            icon={<AddIcon />}
            label={t("hardware.page.addDeviceButton")}
            onClick={() => navigate("/hardware/device/add")}
          />
          <ToolbarButton
            primary
            icon={<AddIcon />}
            label={t("hardware.page.addAccessoryButton")}
            onClick={() => navigate("/hardware/accessory/add")}
          />
        </>
      }
      toolbarEnd={
        <>
          <ToolbarButton
            icon={<TuneIcon />}
            label={t("games.listView.options")}
            onClick={(event) => setMenu({ name: "options", anchor: event.currentTarget })}
            aria-haspopup="menu"
          />
          <ToolbarButton
            icon={view === "table" ? <TableRowsIcon /> : <GridViewIcon />}
            label={t("games.listView.view")}
            onClick={(event) => setMenu({ name: "view", anchor: event.currentTarget })}
            aria-haspopup="menu"
          />
          <ToolbarButton
            icon={<SortIcon />}
            label={t("games.listView.sort")}
            onClick={(event) => setMenu({ name: "sort", anchor: event.currentTarget })}
            aria-haspopup="menu"
          />
          <ToolbarButton
            icon={<FilterAltOutlinedIcon />}
            label={t("games.listView.filter")}
            count={state.activeFilterCount}
            active={state.activeFilterCount > 0}
            onClick={() => setFiltersOpen(true)}
          />
        </>
      }
      actions={
        <ListSearchField
          value={state.searchKeyword}
          onChange={state.setSearchKeyword}
          label={t("common.search")}
          placeholder={t("hardware.searchBar.searchPlaceholder")}
        />
      }
    >
      {chips.length ? (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: -0.5, mb: 0.5 }}>
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              size="small"
              label={chip.label}
              onDelete={chip.onRemove}
              deleteIcon={<CancelIcon aria-label={t("games.listView.removeFilter", { label: chip.label })} />}
            />
          ))}
        </Box>
      ) : null}

      <DeviceList searchKeyword={debouncedKeyword} status={state.status} filters={state.devices} view={view} cardSize={cardSize} />
      <AccessoryList
        searchKeyword={debouncedKeyword}
        status={state.status}
        filters={state.accessories}
        sort={state.sort}
        view={view}
        cardSize={cardSize}
      />

      <Menu anchorEl={menu?.anchor} open={menu?.name === "options"} onClose={closeMenu}>
        <CardSizeSlider value={cardSize} onChange={setCardSize} disabled={view !== "cards"} />
      </Menu>
      <ChoiceMenu<HardwareListView>
        anchor={menu?.name === "view" ? menu.anchor : null}
        onClose={closeMenu}
        choices={[
          { value: "cards", label: t("catalog.index.viewCards"), icon: <GridViewIcon /> },
          { value: "table", label: t("games.listView.view_table"), icon: <TableRowsIcon /> },
        ]}
        selected={view}
        onSelect={setView}
      />
      <ChoiceMenu<HardwareSort>
        anchor={menu?.name === "sort" ? menu.anchor : null}
        onClose={closeMenu}
        choices={[
          { value: "name", label: t("hardware.listToolbar.sortOptionName") },
          { value: "releaseDate", label: t("hardware.listToolbar.sortOptionReleaseDate") },
        ]}
        selected={state.sort}
        onSelect={state.setSort}
      />
      <HardwareFilterDialog state={state} lookups={lookups} open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </Page>
  );
};

export default HardwarePage;
