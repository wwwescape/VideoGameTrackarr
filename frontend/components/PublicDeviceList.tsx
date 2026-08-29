import Paper from "@mui/material/Paper";
import { useTranslation } from "react-i18next";
import { usePublicDevices } from "../hooks/usePublic";
import HardwareCard from "./HardwareCard";
import VirtualGameGrid from "./VirtualGameGrid";

interface PublicDeviceListProps {
  token: string | undefined;
  search: string;
}

// Deliberately not DeviceList.tsx reused — that component renders the full
// HardwareListToolbar, whose filter dropdowns are backed by authenticated lookup
// endpoints that would 401 for an anonymous public-page visitor.
const PublicDeviceList = ({ token, search }: PublicDeviceListProps) => {
  const { t } = useTranslation();
  const { data: devices, isLoading } = usePublicDevices(token, search || undefined);

  if (isLoading) {
    return <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>;
  }
  if (!devices || devices.length === 0) {
    return <Paper sx={{ p: 3, textAlign: "center" }}>{t("public.hardware.emptyState")}</Paper>;
  }

  return (
    <VirtualGameGrid
      items={devices}
      getKey={(device) => device.id}
      renderItem={(device) => (
        <HardwareCard
          name={device.officialName}
          subtitle={[device.manufacturerName, device.hardwarePlatformName].filter(Boolean).join(" · ")}
          imageUrl={device.imageUrl}
          owned={device.owned}
          wishlisted={device.wishlisted}
          ownedQuantity={device.ownedQuantity}
        />
      )}
    />
  );
};

export default PublicDeviceList;
