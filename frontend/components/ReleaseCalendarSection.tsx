import { useNavigate } from "react-router-dom";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { UpcomingRelease } from "../api/types";
import { useReleaseCalendar } from "../hooks/useDashboard";
import { gameIdentifier, hardwareIdentifier } from "../utils/identifiers";
import { formatReleaseDate } from "../utils/utils";
import CardCarousel from "./CardCarousel";
import GameCard from "./GameCard";
import HardwareCard from "./HardwareCard";

interface ReleaseCalendarSectionProps {
  scope: "games" | "hardware";
  title: string;
  // Fixed card width in px (see CardCarousel); omitted, cards share the row like the grids.
  columnWidth?: number;
}

const ReleaseCalendarSection = ({ scope, title, columnWidth }: ReleaseCalendarSectionProps) => {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useReleaseCalendar();
  const navigate = useNavigate();

  // Hardware cards show the release date like the game cards do, or just the year when
  // that's all the hardware reference (or a custom accessory) knows.
  const releaseDateLabel = (item: UpcomingRelease) =>
    item.releaseDatePrecision === "year"
      ? item.releaseDate.slice(0, 4)
      : formatReleaseDate(Date.parse(item.releaseDate) / 1000, i18n.resolvedLanguage ?? i18n.language);

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
      columnWidth={columnWidth}
      renderItem={(item) => {
        if (item.kind === "game" && item.game) {
          return (
            <GameCard
              game={item.game}
              context="list"
              contextFunction={() => navigate(`/game/${gameIdentifier(item.game!)}`)}
              dateFormat="full"
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
              dateLine={releaseDateLabel(item)}
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
              dateLine={releaseDateLabel(item)}
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
