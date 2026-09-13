import ImageNotSupportedOutlinedIcon from "@mui/icons-material/ImageNotSupportedOutlined";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardMedia from "@mui/material/CardMedia";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import type { EventDetail } from "../api/types";

interface EventCoverCardProps {
  event: Pick<EventDetail, "name" | "eventLogoUrl">;
}

// Trimmed GameCoverCard copy — no ownership badges/on-sale chip (neither applies to an
// event), and a landscape aspect ratio: IGDB event logos are banners, confirmed live against
// the real API, not portrait covers like games.
const EventCoverCard = ({ event }: EventCoverCardProps) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Card
      sx={{
        width: "100%",
        maxWidth: "100%",
        position: "relative",
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        overflow: "hidden",
      }}
    >
      <Tooltip title={event.name}>
        <Box sx={{ position: "relative", aspectRatio: "16 / 9", overflow: "hidden" }}>
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
                bgcolor: "action.hover",
                color: "text.secondary",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                p: 2,
                textAlign: "center",
              }}
            >
              <ImageNotSupportedOutlinedIcon fontSize="large" />
              <Typography variant="body2">{t("games.coverCard.noImageAvailable")}</Typography>
            </Box>
          )}
        </Box>
      </Tooltip>
    </Card>
  );
};

export default EventCoverCard;
