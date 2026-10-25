import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDeviceList } from "../hooks/useDevice";
import type { HardwareKindFilters, HardwareStatusFilter } from "../hooks/useHardwareListState";
import { hardwareIdentifier } from "../utils/identifiers";
import { HardwareListSection, type HardwareListView, type HardwareRow } from "./HardwareListViews";

interface DeviceListProps {
  searchKeyword: string;
  status: HardwareStatusFilter;
  filters: HardwareKindFilters;
  view: HardwareListView;
  cardSize: number;
}

const DeviceList = ({ searchKeyword, status, filters, view, cardSize }: DeviceListProps) => {
  const { t } = useTranslation();
  const { manufacturerIds, typeIds, platformIds } = filters;

  const { data: devices, isLoading } = useDeviceList({
    search: searchKeyword || undefined,
    manufacturerIds: manufacturerIds.length > 0 ? manufacturerIds : undefined,
    deviceTypeIds: typeIds.length > 0 ? typeIds : undefined,
    hardwarePlatformIds: platformIds.length > 0 ? platformIds : undefined,
    status: status === "all" ? undefined : status,
  });

  // Devices have no release-date field of their own to sort by (it lives on the linked
  // HardwareReferenceEntry instead) — the page's "Release date" sort is a no-op here.
  const rows = useMemo(
    () =>
      devices
        ? [...devices]
            .sort((a, b) => a.officialName.localeCompare(b.officialName))
            .map(
              (item): HardwareRow => ({
                id: item.id,
                name: item.officialName,
                manufacturer: item.manufacturerName,
                detail: item.hardwarePlatformName,
                imageUrl: item.imageUrl,
                owned: item.owned,
                wishlisted: item.wishlisted,
                ownedQuantity: item.ownedQuantity,
                href: `/hardware/device/${hardwareIdentifier(item.officialName, item.uuid)}`,
              })
            )
        : undefined,
    [devices]
  );

  return (
    <HardwareListSection
      id="devices"
      title={t("hardware.page.devicesHeading")}
      rows={rows}
      isLoading={isLoading}
      emptyMessage={t("hardware.deviceList.emptyState")}
      detailLabel={t("hardware.listToolbar.platformLabel")}
      view={view}
      cardSize={cardSize}
    />
  );
};

export default DeviceList;
