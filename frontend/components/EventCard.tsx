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
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          {/* Same variant/weight/line-height as GameCard's title Typography, so an Events row
              and a Games row read as visually consistent, not just equally wide. */}
          <Typography
            variant="subtitle2"
            component="div"
            sx={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: 1.35,
            }}
          >
            <strong>{event.name}</strong>
          </Typography>
          {dateRange ? (
            // Same variant/color as GameCard's release-year Typography.
            <Typography variant="caption" color="text.secondary" component="div">
              {dateRange}
            </Typography>
          ) : null}
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default EventCard;
