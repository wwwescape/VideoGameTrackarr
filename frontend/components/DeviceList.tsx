import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { useDeviceList } from "../hooks/useDevice";
import { useDeviceTypes, useHardwarePlatforms, useManufacturers } from "../hooks/useHardwareLookups";
import { hardwareIdentifier } from "../utils/identifiers";
import HardwareCard from "./HardwareCard";
import HardwareListToolbar, { type HardwareSort, type HardwareStatusFilter } from "./HardwareListToolbar";
import VirtualGameGrid from "./VirtualGameGrid";

interface DeviceListProps {
  searchKeyword: string;
  status: HardwareStatusFilter;
}

const DeviceList = ({ searchKeyword, status }: DeviceListProps) => {
  const navigate = useNavigate();
  const [sort, setSort] = useState<HardwareSort>("name");
  const [manufacturerId, setManufacturerId] = useState<number | "">("");
  const [deviceTypeId, setDeviceTypeId] = useState<number | "">("");
  const [hardwarePlatformId, setHardwarePlatformId] = useState<number | "">("");

  const { data: manufacturers } = useManufacturers();
  const { data: deviceTypes } = useDeviceTypes();
  const { data: hardwarePlatforms } = useHardwarePlatforms();

  const { data: devices, isLoading } = useDeviceList({
    search: searchKeyword || undefined,
    manufacturerId: manufacturerId || undefined,
    deviceTypeId: deviceTypeId || undefined,
    hardwarePlatformId: hardwarePlatformId || undefined,
    status: status === "all" ? undefined : status,
  });

  // Devices have no release-date field of their own to sort by (it lives on the linked
  // HardwareReferenceEntry instead) — "Release date" in the shared toolbar is a no-op here.
  const sortedDevices = useMemo(() => {
    if (!devices) return [];
    const items = [...devices];
    items.sort((a, b) => a.officialName.localeCompare(b.officialName));
    return items;
  }, [devices]);

  return (
    <Stack spacing={2}>
      <HardwareListToolbar
        sort={sort}
        onSortChange={setSort}
        manufacturerOptions={manufacturers ?? []}
        manufacturerId={manufacturerId}
        onManufacturerChange={setManufacturerId}
        typeLabel="Device type"
        typeOptions={deviceTypes ?? []}
        typeId={deviceTypeId}
        onTypeChange={setDeviceTypeId}
        platformOptions={hardwarePlatforms ?? []}
        platformId={hardwarePlatformId}
        onPlatformChange={setHardwarePlatformId}
      />
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>Loading...</Paper>
      ) : sortedDevices.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>No devices found.</Paper>
      ) : (
        <VirtualGameGrid
          items={sortedDevices}
          getKey={(item) => item.id}
          renderItem={(item) => (
            <HardwareCard
              name={item.officialName}
              subtitle={[item.manufacturerName, item.hardwarePlatformName].filter(Boolean).join(" · ")}
              imageUrl={null}
              owned={item.owned}
              wishlisted={item.wishlisted}
              ownedQuantity={item.ownedQuantity}
              onClick={() => navigate(`/hardware/device/${hardwareIdentifier(item.officialName, item.uuid)}`)}
            />
          )}
        />
      )}
    </Stack>
  );
};

export default DeviceList;
