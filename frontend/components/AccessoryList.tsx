import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAccessoryList } from "../hooks/useAccessories";
import type { HardwareKindFilters, HardwareSort, HardwareStatusFilter } from "../hooks/useHardwareListState";
import { hardwareIdentifier } from "../utils/identifiers";
import { HardwareListSection, type HardwareListView, type HardwareRow } from "./HardwareListViews";

interface AccessoryListProps {
  searchKeyword: string;
  status: HardwareStatusFilter;
  filters: HardwareKindFilters;
  sort: HardwareSort;
  view: HardwareListView;
  cardSize: number;
}

const AccessoryList = ({ searchKeyword, status, filters, sort, view, cardSize }: AccessoryListProps) => {
  const { t } = useTranslation();
  const { manufacturerIds, typeIds, platformIds } = filters;

  const { data: accessories, isLoading } = useAccessoryList({
    search: searchKeyword || undefined,
    manufacturerIds: manufacturerIds.length > 0 ? manufacturerIds : undefined,
    accessoryTypeIds: typeIds.length > 0 ? typeIds : undefined,
    hardwarePlatformIds: platformIds.length > 0 ? platformIds : undefined,
    status: status === "all" ? undefined : status,
  });

  const rows = useMemo(() => {
    if (!accessories) return undefined;
    const items = [...accessories];
    if (sort === "releaseDate") {
      items.sort((a, b) => (b.releaseDate ?? 0) - (a.releaseDate ?? 0));
    } else {
      items.sort((a, b) => a.officialName.localeCompare(b.officialName));
    }
    return items.map(
      (item): HardwareRow => ({
        id: item.id,
        name: item.officialName,
        manufacturer: item.manufacturerName,
        detail: item.accessoryTypeName,
        imageUrl: item.imageUrl,
        owned: item.owned,
        wishlisted: item.wishlisted,
        ownedQuantity: item.ownedQuantity,
        href: `/hardware/accessory/${hardwareIdentifier(item.officialName, item.uuid)}`,
      })
    );
  }, [accessories, sort]);

  return (
    <HardwareListSection
      id="accessories"
      title={t("hardware.page.accessoriesHeading")}
      rows={rows}
      isLoading={isLoading}
      emptyMessage={t("hardware.accessoryList.emptyState")}
      detailLabel={t("hardware.accessoryList.typeLabel")}
      view={view}
      cardSize={cardSize}
    />
  );
};

export default AccessoryList;
