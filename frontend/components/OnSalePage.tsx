import { useMemo, useState } from "react";
import GridViewIcon from "@mui/icons-material/GridView";
import TableRowsIcon from "@mui/icons-material/TableRows";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { OnSaleItem } from "../api/types";
import { useOnSale } from "../hooks/useInsights";
import { useLocalPreference } from "../hooks/useLocalPreference";
import { useSessionState } from "../hooks/useSessionState";
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

export type OnSaleSort = "best" | "discount" | "price" | "name";
type TargetFilter = "all" | "reached";

// "Best deals" is the server's own order: target price reached first, then biggest discount.
const SORTERS: Record<Exclude<OnSaleSort, "best">, (a: OnSaleItem, b: OnSaleItem) => number> = {
  discount: (a, b) => (b.currentCut ?? 0) - (a.currentCut ?? 0),
  // Amounts in different currencies are compared as they are; most libraries use one.
  price: (a, b) => a.currentPriceAmount - b.currentPriceAmount,
  name: (a, b) => a.game.name.localeCompare(b.game.name),
};

// Insights → On Sale: wishlisted games on sale, as covers or a price table, with the same
// toolbar as the Games list. Search, sort and filters are client-side over the full list.
const OnSalePage = () => {
  const { t } = useTranslation();
  const { data: items, isLoading } = useOnSale();
  const [searchKeyword, setSearchKeyword] = useSessionState("onSale.searchKeyword", "");
  const [sort, setSort] = useSessionState<OnSaleSort>("onSale.sort", "best");
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
    return sort === "best" ? filtered : [...filtered].sort(SORTERS[sort]);
  }, [items, searchKeyword, stores, target, sort]);

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
          sort={{
            value: sort,
            onChange: setSort,
            choices: [
              { value: "best", label: t("insights.onSale.sortBest") },
              { value: "discount", label: t("insights.onSale.sortDiscount") },
              { value: "price", label: t("insights.onSale.sortPrice") },
              { value: "name", label: t("games.listToolbar.sortNameAsc") },
            ],
          }}
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
        <OnSaleSection items={visible} view={view} cardSize={cardSize} />
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
