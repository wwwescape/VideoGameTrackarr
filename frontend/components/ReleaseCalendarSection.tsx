import { useNavigate } from "react-router-dom";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useReleaseCalendar } from "../hooks/useDashboard";
import { gameIdentifier, hardwareIdentifier } from "../utils/identifiers";
import CardCarousel from "./CardCarousel";
import GameCard from "./GameCard";
import HardwareCard from "./HardwareCard";

interface ReleaseCalendarSectionProps {
  scope: "games" | "hardware";
  title: string;
}

const ReleaseCalendarSection = ({ scope, title }: ReleaseCalendarSectionProps) => {
  const { t } = useTranslation();
  const { data, isLoading } = useReleaseCalendar();
  const navigate = useNavigate();

  if (isLoading) {
    return <Typography color="text.secondary">{t("releaseCalendar.loading")}</Typography>;
  }

  const releases = (data ?? []).filter((item) =>
    scope === "games" ? item.kind === "game" : item.kind !== "game"
  );

  if (releases.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t("releaseCalendar.empty", {
          itemType:
            scope === "games"
              ? t("releaseCalendar.itemTypeGame")
              : t("releaseCalendar.itemTypeHardware"),
        })}
      </Typography>
    );
  }

  return (
    <CardCarousel
      items={releases}
      getItemKey={(item) =>
        item.kind === "game"
          ? `game-${item.game!.id}`
          : item.kind === "device"
            ? `device-${item.device!.id}`
            : `accessory-${item.accessory!.id}`
      }
      title={title}
      renderItem={(item) => {
        if (item.kind === "game" && item.game) {
          return (
            <GameCard
              game={item.game}
              context="list"
              contextFunction={() => navigate(`/game/${gameIdentifier(item.game!)}`)}
            />
          );
        }
        if (item.kind === "device" && item.device) {
          return (
            <HardwareCard
              name={item.device.officialName}
              subtitle={[item.device.manufacturerName, item.device.hardwarePlatformName]
                .filter(Boolean)
                .join(" · ")}
              imageUrl={item.device.imageUrl}
              owned={item.device.owned}
              wishlisted={item.device.wishlisted}
              ownedQuantity={item.device.ownedQuantity}
              onClick={() =>
                navigate(
                  `/hardware/device/${hardwareIdentifier(item.device!.officialName, item.device!.uuid)}`
                )
              }
            />
          );
        }
        if (item.kind === "accessory" && item.accessory) {
          return (
            <HardwareCard
              name={item.accessory.officialName}
              subtitle={[item.accessory.manufacturerName, item.accessory.accessoryTypeName]
                .filter(Boolean)
                .join(" · ")}
              imageUrl={item.accessory.imageUrl}
              owned={item.accessory.owned}
              wishlisted={item.accessory.wishlisted}
              ownedQuantity={item.accessory.ownedQuantity}
              onClick={() =>
                navigate(
                  `/hardware/accessory/${hardwareIdentifier(item.accessory!.officialName, item.accessory!.uuid)}`
                )
              }
            />
          );
        }
        return null;
      }}
    />
  );
};

export default ReleaseCalendarSection;
