import { useMemo, useState } from "react";
import GridViewIcon from "@mui/icons-material/GridView";
import TableRowsIcon from "@mui/icons-material/TableRows";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { OnSaleItem } from "../api/types";
import { useOnSale } from "../hooks/useInsights";
import { useListSort } from "../hooks/useListSort";
import { useLocalPreference } from "../hooks/useLocalPreference";
import { useSessionState } from "../hooks/useSessionState";
import { sortRows, type SortField } from "../utils/listSort";
import AutocompleteMultiSelect from "./AutocompleteMultiSelect";
import { CARD_SIZE_DEFAULT } from "./GameListViews";
import { ListSearchField } from "./ListControls";
import {
  FilterChips,
  FilterDialog,
  ListToolbar,
  ToggleFilter,
  type FilterChip,
} from "./ListToolbar";
import OnSaleSection, { type OnSaleView } from "./OnSaleSection";
import Page from "./Page";

export type OnSaleSort = "best" | "name" | "price" | "discount" | "store" | "historical_low" | "target";
type TargetFilter = "all" | "reached";

// Insights → On Sale: wishlisted games on sale, as covers or a price table, with the same
// toolbar as the Games list. Search, sort and filters are client-side over the full list.
const OnSalePage = () => {
  const { t } = useTranslation();
  const { data: items, isLoading } = useOnSale();
  const [searchKeyword, setSearchKeyword] = useSessionState("onSale.searchKeyword", "");
  const sortFields: SortField<OnSaleSort>[] = [
    { field: "best", label: t("insights.onSale.sortBest") },
    { field: "name", label: t("games.listView.columnName") },
    { field: "price", label: t("insights.onSale.columnPrice") },
    { field: "discount", label: t("insights.onSale.columnDiscount"), defaultDirection: "desc" },
    { field: "store", label: t("insights.onSale.columnStore") },
    { field: "historical_low", label: t("insights.onSale.columnHistoricalLow") },
    { field: "target", label: t("insights.onSale.columnTarget") },
  ];
  const sort = useListSort("onSale.sortBy", sortFields, { field: "best", direction: "asc" });
  const [stores, setStores] = useSessionState<string[]>("onSale.stores", []);
  const [target, setTarget] = useSessionState<TargetFilter>("onSale.target", "all");
  const [view, setView] = useLocalPreference<OnSaleView>("onSale.view", "covers");
  const [cardSize, setCardSize] = useLocalPreference("onSale.cardSize", CARD_SIZE_DEFAULT);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const storeOptions = useMemo(
    () =>
      [
        ...new Set(
          (items ?? []).map((item) => item.currentShopName).filter((name): name is string => !!name)
        ),
      ].sort(),
    [items]
  );

  const visible = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    const filtered = (items ?? []).filter(
      (item) =>
        (!keyword || item.game.name.toLowerCase().includes(keyword)) &&
        (!stores.length ||
          (item.currentShopName !== null && stores.includes(item.currentShopName))) &&
        (target === "all" || item.isTargetHit)
    );
    // "Best deals" is the server's own order: target price reached first, then biggest
    // discount. Amounts in different currencies are compared as they are; most libraries use one.
    const serverOrder = new Map((items ?? []).map((item, index) => [item.libraryItemId, index]));
    const values: Record<OnSaleSort, (item: OnSaleItem) => number | string | null> = {
      best: (item) => serverOrder.get(item.libraryItemId) ?? null,
      name: (item) => item.game.name,
      price: (item) => item.currentPriceAmount,
      discount: (item) => item.currentCut,
      store: (item) => item.currentShopName,
      historical_low: (item) => item.historicalLowAmount,
      target: (item) => item.targetPrice,
    };
    return sortRows(filtered, sort.sort, values, (item) => item.game.name);
  }, [items, searchKeyword, stores, target, sort.sort]);

  const activeFilterCount = stores.length + (target === "all" ? 0 : 1);
  const clearFilters = () => {
    setStores([]);
    setTarget("all");
  };
  const chips: FilterChip[] = [
    ...stores.map((store) => ({
      key: `store-${store}`,
      label: store,
      onRemove: () => setStores(stores.filter((other) => other !== store)),
    })),
    ...(target === "reached"
      ? [
          {
            key: "target",
            label: t("insights.onSale.targetReached"),
            onRemove: () => setTarget("all"),
          },
        ]
      : []),
  ];

  return (
    <Page
      meta={items ? t("games.listView.gameCount", { count: visible.length }) : undefined}
      toolbarEnd={
        <ListToolbar<OnSaleView, OnSaleSort>
          cardSize={{ value: cardSize, onChange: setCardSize, disabled: view !== "covers" }}
          view={{
            value: view,
            onChange: setView,
            choices: [
              { value: "covers", label: t("games.listView.view_covers"), icon: <GridViewIcon /> },
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
          label={t("games.listToolbar.searchLabel")}
          placeholder={t("games.listToolbar.searchPlaceholder")}
        />
      }
    >
      <FilterChips chips={chips} />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("insights.onSale.description")}
      </Typography>
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : !items?.length ? (
        <Typography variant="body2" color="text.secondary">
          {t("insights.onSale.noneFound")}
        </Typography>
      ) : !visible.length ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.listToolbar.noSearchMatches")}</Paper>
      ) : (
        <OnSaleSection items={visible} view={view} cardSize={cardSize} sort={sort} />
      )}

      <FilterDialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onClear={clearFilters}
        activeCount={activeFilterCount}
      >
        <AutocompleteMultiSelect<string>
          label={t("insights.onSale.columnStore")}
          options={storeOptions}
          value={stores}
          onChange={setStores}
          getOptionLabel={(store) => store}
          placeholder={t("games.listToolbar.allOption")}
          fullWidth
        />
        <ToggleFilter<TargetFilter>
          id="on-sale-target"
          label={t("insights.onSale.columnTarget")}
          value={target}
          onChange={setTarget}
          options={[
            { value: "all", label: t("games.listToolbar.allOption") },
            { value: "reached", label: t("insights.onSale.targetReached") },
          ]}
        />
      </FilterDialog>
    </Page>
  );
};

export default OnSalePage;
