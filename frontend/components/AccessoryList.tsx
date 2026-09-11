import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { useTranslation } from "react-i18next";
import { useAccessoryList } from "../hooks/useAccessories";
import { useAccessoryTypes, useHardwarePlatforms, useManufacturers } from "../hooks/useHardwareLookups";
import { hardwareIdentifier } from "../utils/identifiers";
import HardwareCard from "./HardwareCard";
import HardwareListToolbar, { type HardwareSort, type HardwareStatusFilter } from "./HardwareListToolbar";
import VirtualGameGrid from "./VirtualGameGrid";

interface AccessoryListProps {
  searchKeyword: string;
  status: HardwareStatusFilter;
}

const AccessoryList = ({ searchKeyword, status }: AccessoryListProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sort, setSort] = useState<HardwareSort>("name");
  const [manufacturerIds, setManufacturerIds] = useState<number[]>([]);
  const [accessoryTypeIds, setAccessoryTypeIds] = useState<number[]>([]);
  const [hardwarePlatformIds, setHardwarePlatformIds] = useState<number[]>([]);

  const { data: manufacturers } = useManufacturers();
  const { data: accessoryTypes } = useAccessoryTypes();
  const { data: hardwarePlatforms } = useHardwarePlatforms();

  const { data: accessories, isLoading } = useAccessoryList({
    search: searchKeyword || undefined,
    manufacturerIds: manufacturerIds.length > 0 ? manufacturerIds : undefined,
    accessoryTypeIds: accessoryTypeIds.length > 0 ? accessoryTypeIds : undefined,
    hardwarePlatformIds: hardwarePlatformIds.length > 0 ? hardwarePlatformIds : undefined,
    status: status === "all" ? undefined : status,
  });

  const sortedAccessories = useMemo(() => {
    if (!accessories) return [];
    const items = [...accessories];
    if (sort === "releaseDate") {
      items.sort((a, b) => (b.releaseDate ?? 0) - (a.releaseDate ?? 0));
    } else {
      items.sort((a, b) => a.officialName.localeCompare(b.officialName));
    }
    return items;
  }, [accessories, sort]);

  return (
    <Stack spacing={2}>
      <HardwareListToolbar
        sort={sort}
        onSortChange={setSort}
        manufacturerOptions={manufacturers ?? []}
        manufacturerIds={manufacturerIds}
        onManufacturerIdsChange={setManufacturerIds}
        typeLabel={t("hardware.accessoryList.typeLabel")}
        typeOptions={accessoryTypes ?? []}
        typeIds={accessoryTypeIds}
        onTypeIdsChange={setAccessoryTypeIds}
        platformOptions={hardwarePlatforms ?? []}
        platformIds={hardwarePlatformIds}
        onPlatformIdsChange={setHardwarePlatformIds}
      />
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : sortedAccessories.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("hardware.accessoryList.emptyState")}</Paper>
      ) : (
        <VirtualGameGrid
          items={sortedAccessories}
          getKey={(item) => item.id}
          renderItem={(item) => (
            <HardwareCard
              name={item.officialName}
              subtitle={[item.manufacturerName, item.accessoryTypeName].filter(Boolean).join(" · ")}
              imageUrl={item.imageUrl}
              owned={item.owned}
              wishlisted={item.wishlisted}
              ownedQuantity={item.ownedQuantity}
              onClick={() => navigate(`/hardware/accessory/${hardwareIdentifier(item.officialName, item.uuid)}`)}
            />
          )}
        />
      )}
    </Stack>
  );
};

export default AccessoryList;
