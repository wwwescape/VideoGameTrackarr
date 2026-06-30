import { useNavigate } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { useReleaseCalendar } from "../hooks/useDashboard";
import { gameIdentifier, hardwareIdentifier } from "../utils/identifiers";
import GameCard from "./GameCard";
import HardwareCard from "./HardwareCard";

interface ReleaseCalendarSectionProps {
  scope: "games" | "hardware";
}

const ReleaseCalendarSection = ({ scope }: ReleaseCalendarSectionProps) => {
  const { data, isLoading } = useReleaseCalendar();
  const navigate = useNavigate();

  if (isLoading) {
    return <Typography color="text.secondary">Loading release calendar...</Typography>;
  }

  const releases = (data ?? []).filter((item) => (scope === "games" ? item.kind === "game" : item.kind !== "game"));

  if (releases.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No upcoming releases — wishlist an unreleased {scope === "games" ? "game" : "piece of hardware"} to see it
        here.
      </Typography>
    );
  }

  return (
    <Grid container spacing={{ xs: 1.5, sm: 2 }}>
      {releases.map((item) => {
        if (item.kind === "game" && item.game) {
          return (
            <Grid key={`game-${item.game.id}`} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
              <GameCard
                game={item.game}
                context="list"
                contextFunction={() => navigate(`/game/${gameIdentifier(item.game!)}`)}
              />
            </Grid>
          );
        }
        if (item.kind === "device" && item.device) {
          return (
            <Grid key={`device-${item.device.id}`} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
              <HardwareCard
                name={item.device.officialName}
                subtitle={[item.device.manufacturerName, item.device.hardwarePlatformName].filter(Boolean).join(" · ")}
                imageUrl={null}
                owned={item.device.owned}
                wishlisted={item.device.wishlisted}
                ownedQuantity={item.device.ownedQuantity}
                onClick={() =>
                  navigate(`/hardware/device/${hardwareIdentifier(item.device!.officialName, item.device!.uuid)}`)
                }
              />
            </Grid>
          );
        }
        if (item.kind === "accessory" && item.accessory) {
          return (
            <Grid key={`accessory-${item.accessory.id}`} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
              <HardwareCard
                name={item.accessory.officialName}
                subtitle={[item.accessory.manufacturerName, item.accessory.accessoryTypeName].filter(Boolean).join(" · ")}
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
            </Grid>
          );
        }
        return null;
      })}
    </Grid>
  );
};

export default ReleaseCalendarSection;
