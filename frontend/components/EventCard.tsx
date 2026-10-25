import ImageNotSupportedOutlinedIcon from "@mui/icons-material/ImageNotSupportedOutlined";
import Box from "@mui/material/Box";
import { useNavigate } from "react-router-dom";
import { resolveAssetUrl } from "../api/client";
import type { EventSummary } from "../api/types";
import { formatEventDateRange } from "../utils/utils";
import FlatTile from "./FlatTile";

interface EventCardProps {
  event: EventSummary;
}

// The event's 16:9 banner with its name and dates under it, in GameCard's flat look.
const EventCard = ({ event }: EventCardProps) => {
  const navigate = useNavigate();
  const dateRange = formatEventDateRange(event.startTime, event.endTime);

  return (
    <FlatTile
      name={event.name}
      onClick={() => navigate(`/events/${event.slug ?? event.id}`)}
      mediaSx={{ aspectRatio: "16 / 9" }}
      lines={[dateRange ?? " "]}
      media={
        event.eventLogoUrl ? (
          <Box
            component="img"
            alt={event.name}
            src={resolveAssetUrl(event.eventLogoUrl) ?? undefined}
            loading="lazy"
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "vgt.text3",
            }}
          >
            <ImageNotSupportedOutlinedIcon fontSize="large" />
          </Box>
        )
      }
    />
  );
};

export default EventCard;
