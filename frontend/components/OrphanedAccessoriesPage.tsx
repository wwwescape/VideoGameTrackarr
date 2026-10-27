import { useMemo, useState } from "react";
import GridViewIcon from "@mui/icons-material/GridView";
import TableRowsIcon from "@mui/icons-material/TableRows";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useAccessoriesWithoutOwnedHardware } from "../hooks/useInsights";
import { useLocalPreference } from "../hooks/useLocalPreference";
import { useListSort } from "../hooks/useListSort";
import { useSessionState } from "../hooks/useSessionState";
import { hardwareIdentifier } from "../utils/identifiers";
import type { SortField } from "../utils/listSort";
import AutocompleteMultiSelect from "./AutocompleteMultiSelect";
import { CARD_SIZE_DEFAULT } from "./GameListViews";
import {
  HardwareListSection,
  type HardwareListView,
  type HardwareRow,
  type HardwareSortField,
} from "./HardwareListViews";
import { ListSearchField } from "./ListControls";
import { FilterChips, FilterDialog, ListToolbar, type FilterChip } from "./ListToolbar";
import Page from "./Page";

// Insights → Orphaned accessories: accessories you own with none of their devices owned, as
// Hardware cards or a table, with Hardware's search, sort and Manufacturer/Type filters.
const OrphanedAccessoriesPage = () => {
  const { t } = useTranslation();
  const { data: accessories, isLoading } = useAccessoriesWithoutOwnedHardware();
  const [view, setView] = useLocalPreference<HardwareListView>("orphans.view", "cards");
  const [cardSize, setCardSize] = useLocalPreference("orphans.cardSize", CARD_SIZE_DEFAULT);
  const [searchKeyword, setSearchKeyword] = useSessionState("orphans.searchKeyword", "");
  const sortFields: SortField<HardwareSortField>[] = [
    { field: "name", label: t("games.listView.columnName") },
    { field: "manufacturer", label: t("hardware.listToolbar.manufacturerLabel") },
    { field: "detail", label: t("hardware.accessoryList.typeLabel") },
    { field: "date_added", label: t("games.listView.sortDateAdded"), defaultDirection: "desc" },
  ];
  const sort = useListSort("orphans.sortBy", sortFields, { field: "name", direction: "asc" });
  const [manufacturers, setManufacturers] = useSessionState<string[]>("orphans.manufacturers", []);
  const [types, setTypes] = useSessionState<string[]>("orphans.types", []);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const distinct = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
  const manufacturerOptions = useMemo(
    () => distinct((accessories ?? []).map((item) => item.manufacturerName)),
    [accessories]
  );
  const typeOptions = useMemo(
    () => distinct((accessories ?? []).map((item) => item.accessoryTypeName)),
    [accessories]
  );

  // Only owned accessories are listed; the list doesn't carry how many you own.
  const rows: HardwareRow[] | undefined = useMemo(() => {
    if (!accessories) return undefined;
    const keyword = searchKeyword.trim().toLowerCase();
    return accessories
      .filter(
        (item) =>
          (!keyword || item.officialName.toLowerCase().includes(keyword)) &&
          (!manufacturers.length || manufacturers.includes(item.manufacturerName)) &&
          (!types.length || types.includes(item.accessoryTypeName))
      )
      .map((accessory) => ({
        id: accessory.id,
        name: accessory.officialName,
        manufacturer: accessory.manufacturerName,
        detail: accessory.accessoryTypeName,
        imageUrl: accessory.imageUrl,
        owned: true,
        wishlisted: false,
        ownedQuantity: 1,
        href: `/hardware/accessory/${hardwareIdentifier(accessory.officialName, accessory.uuid)}`,
        createdAt: accessory.createdAt,
      }));
  }, [accessories, searchKeyword, manufacturers, types]);

  const activeFilterCount = manufacturers.length + types.length;
  const chips: FilterChip[] = [
    ...manufacturers.map((name) => ({
      key: `manufacturer-${name}`,
      label: name,
      onRemove: () => setManufacturers(manufacturers.filter((other) => other !== name)),
    })),
    ...types.map((name) => ({
      key: `type-${name}`,
      label: name,
      onRemove: () => setTypes(types.filter((other) => other !== name)),
    })),
  ];

  return (
    <Page
      toolbarEnd={
        <ListToolbar<HardwareListView, HardwareSortField>
          cardSize={{ value: cardSize, onChange: setCardSize, disabled: view !== "cards" }}
          view={{
            value: view,
            onChange: setView,
            choices: [
              { value: "cards", label: t("catalog.index.viewCards"), icon: <GridViewIcon /> },
              { value: "table", label: t("games.listView.view_table"), icon: <TableRowsIcon /> },
            ],
          }}
          sort={sort}
          filter={{ count: activeFilterCount, onOpen: () => setFiltersOpen(true) }}
        />
      }
      actions={
        <ListSearchField
          value={searchKeyword}
          onChange={setSearchKeyword}
          label={t("common.search")}
          placeholder={t("hardware.searchBar.searchPlaceholder")}
        />
      }
    >
      <FilterChips chips={chips} />
      <Typography variant="body2" color="text.secondary">
        {t("insights.orphans.description")}
      </Typography>
      <HardwareListSection
        id="accessories"
        title={t("hardware.page.accessoriesHeading")}
        rows={rows}
        isLoading={isLoading}
        emptyMessage={
          accessories?.length
            ? t("games.listToolbar.noSearchMatches")
            : t("hardware.accessoriesWithoutOwnedHardware.empty")
        }
        detailLabel={t("hardware.accessoryList.typeLabel")}
        view={view}
        cardSize={cardSize}
        compact
        sort={sort}
      />

      <FilterDialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onClear={() => {
          setManufacturers([]);
          setTypes([]);
        }}
        activeCount={activeFilterCount}
      >
        <AutocompleteMultiSelect<string>
          label={t("hardware.listToolbar.manufacturerLabel")}
          options={manufacturerOptions}
          value={manufacturers}
          onChange={setManufacturers}
          getOptionLabel={(name) => name}
          placeholder={t("hardware.listToolbar.allOption")}
          fullWidth
        />
        <AutocompleteMultiSelect<string>
          label={t("hardware.accessoryList.typeLabel")}
          options={typeOptions}
          value={types}
          onChange={setTypes}
          getOptionLabel={(name) => name}
          placeholder={t("hardware.listToolbar.allOption")}
          fullWidth
        />
      </FilterDialog>
    </Page>
  );
};

export default OrphanedAccessoriesPage;
