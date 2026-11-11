import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ToysToLifeItemSummary } from "../api/types";
import { useToysToLifeItems } from "../hooks/useToysToLife";
import { PACK_TYPE_ORDER, packTypeLabel, statusLabel, toyPath } from "../utils/toysToLife";
import CatalogIndexGrid, { type CatalogIndexColumn } from "./CatalogIndexGrid";
import HardwareCard from "./HardwareCard";
import NotFoundPage from "./NotFoundPage";

// A line's packs (every starter kit included, one per platform), each opening its own page.
// Starts in set-number order, which puts the starter kits first.
const ToysToLifeLinePage = () => {
  const { t } = useTranslation();
  const { line } = useParams<{ line: string }>();
  const { data: items, isLoading, isError } = useToysToLifeItems(line);

  const packTypes = useMemo(() => {
    const present = new Set(items?.map((item) => item.packType));
    // Known types in their usual order, then anything new the CSV brings.
    return [...PACK_TYPE_ORDER.filter((type) => present.has(type)), ...[...present].filter((type) => !PACK_TYPE_ORDER.includes(type))];
  }, [items]);

  if (isError) {
    return (
      <NotFoundPage
        title={t("errors.toysToLifeLineNotFoundTitle")}
        message={t("errors.notFoundMessage")}
        actionLabel={t("errors.backTo", { page: t("nav.toysToLife") })}
        actionTo="/toys-to-life"
      />
    );
  }

  const tableColumns: CatalogIndexColumn<ToysToLifeItemSummary>[] = [
    {
      key: "setNumber",
      label: t("toysToLife.columnSetNumber"),
      render: (item) => item.setNumber,
      sortValue: (item) => item.setNumber,
      defaultDirection: "asc",
    },
    { key: "packType", label: t("toysToLife.columnPackType"), render: (item) => packTypeLabel(item.packType, t) },
    { key: "franchise", label: t("toysToLife.columnFranchise"), render: (item) => item.franchise, hideOnPhone: true },
    { key: "status", label: t("toysToLife.columnStatus"), render: (item) => statusLabel(item, t), hideOnPhone: true },
  ];

  return (
    <CatalogIndexGrid
      stateKey={`toysToLife.${line}`}
      emptyMessage={t("toysToLife.linePage.emptyMessage")}
      countKey="toysToLife.packCount"
      searchLabel={t("toysToLife.linePage.searchLabel")}
      searchPlaceholder={t("toysToLife.linePage.searchPlaceholder")}
      entries={items}
      isLoading={isLoading}
      getHref={toyPath}
      getSearchText={(item) => [item.name, item.setNumber, item.franchise, item.minifigures].filter(Boolean).join(" ")}
      defaultSort={{ field: "setNumber", direction: "asc" }}
      renderCard={(item, onClick) => (
        <HardwareCard
          name={item.name}
          subtitle={`${packTypeLabel(item.packType, t)} · ${item.setNumber}`}
          imageUrl={item.imageUrl}
          owned={item.owned}
          wishlisted={item.wishlisted}
          onClick={onClick}
        />
      )}
      tableColumns={tableColumns}
      statusFilter={{
        label: t("catalog.index.filterOwnership"),
        choices: [
          { value: "owned", label: t("toysToLife.statusOwned"), matches: (item) => item.owned },
          { value: "wishlist", label: t("toysToLife.statusWishlist"), matches: (item) => item.wishlisted },
          { value: "notOwned", label: t("toysToLife.statusNotOwned"), matches: (item) => !item.owned && !item.wishlisted },
        ],
      }}
      extraFilters={[
        {
          key: "packType",
          label: t("toysToLife.filterPackType"),
          choices: packTypes.map((type) => ({
            value: type,
            label: packTypeLabel(type, t),
            matches: (item: ToysToLifeItemSummary) => item.packType === type,
          })),
        },
      ]}
    />
  );
};

export default ToysToLifeLinePage;
