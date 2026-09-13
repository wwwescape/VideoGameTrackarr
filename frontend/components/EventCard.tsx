import ImageNotSupportedOutlinedIcon from "@mui/icons-material/ImageNotSupportedOutlined";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Typography from "@mui/material/Typography";
import { useNavigate } from "react-router-dom";
import { resolveAssetUrl } from "../api/client";
import type { EventSummary } from "../api/types";
import { formatEventDateRange } from "../utils/utils";

interface EventCardProps {
  event: EventSummary;
}

const EventCard = ({ event }: EventCardProps) => {
  const navigate = useNavigate();
  const dateRange = formatEventDateRange(event.startTime, event.endTime);

  return (
    <Card sx={{ width: "100%", borderRadius: 2, overflow: "hidden" }}>
      <CardActionArea onClick={() => navigate(`/events/${event.slug ?? event.id}`)}>
        <Box sx={{ position: "relative", aspectRatio: "16 / 9", bgcolor: "action.hover" }}>
          {event.eventLogoUrl ? (
            <CardMedia
              component="img"
              alt={event.name}
              image={resolveAssetUrl(event.eventLogoUrl) ?? undefined}
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "text.secondary",
              }}
            >
              <ImageNotSupportedOutlinedIcon fontSize="large" />
            </Box>
          )}
        </Box>
        <CardContent>
          <Typography variant="subtitle1" noWrap>
            {event.name}
          </Typography>
          {dateRange ? (
            <Typography variant="body2" color="text.secondary">
              {dateRange}
            </Typography>
          ) : null}
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default EventCard;
