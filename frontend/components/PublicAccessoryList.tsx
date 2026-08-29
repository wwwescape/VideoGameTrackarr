import Paper from "@mui/material/Paper";
import { useTranslation } from "react-i18next";
import { usePublicAccessories } from "../hooks/usePublic";
import HardwareCard from "./HardwareCard";
import VirtualGameGrid from "./VirtualGameGrid";

interface PublicAccessoryListProps {
  token: string | undefined;
  search: string;
}

// Deliberately not AccessoryList.tsx reused — same reasoning as PublicDeviceList.tsx.
const PublicAccessoryList = ({ token, search }: PublicAccessoryListProps) => {
  const { t } = useTranslation();
  const { data: accessories, isLoading } = usePublicAccessories(token, search || undefined);

  if (isLoading) {
    return <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>;
  }
  if (!accessories || accessories.length === 0) {
    return <Paper sx={{ p: 3, textAlign: "center" }}>{t("public.hardware.emptyState")}</Paper>;
  }

  return (
    <VirtualGameGrid
      items={accessories}
      getKey={(accessory) => accessory.id}
      renderItem={(accessory) => (
        <HardwareCard
          name={accessory.officialName}
          subtitle={accessory.manufacturerName}
          imageUrl={accessory.imageUrl}
          owned={accessory.owned}
          wishlisted={accessory.wishlisted}
          ownedQuantity={accessory.ownedQuantity}
        />
      )}
    />
  );
};

export default PublicAccessoryList;
