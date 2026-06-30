import ImageNotSupportedOutlinedIcon from "@mui/icons-material/ImageNotSupportedOutlined";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardMedia from "@mui/material/CardMedia";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { resolveAssetUrl } from "../api/client";
import OwnershipBadges from "./OwnershipBadges";

interface HardwareCoverCardProps {
  name: string;
  imageUrl: string | null;
  owned: boolean;
  wishlisted: boolean;
}

// Device/Accessory details pages' equivalent of GameCoverCard.tsx — same non-clickable
// bordered-card treatment, but a 4:3 aspect ratio (matching HardwareCard.tsx's grid-card
// convention for product shots) rather than GameCoverCard's 3:4 poster ratio.
const HardwareCoverCard = ({ name, imageUrl, owned, wishlisted }: HardwareCoverCardProps) => {
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
      <OwnershipBadges owned={owned} wishlisted={wishlisted} />
      <Tooltip title={name}>
        <Box sx={{ position: "relative", aspectRatio: "4 / 3", overflow: "hidden" }}>
          {imageUrl ? (
            <CardMedia
              component="img"
              alt={name}
              image={resolveAssetUrl(imageUrl) ?? undefined}
              sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
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
              <Typography variant="body2">No Image Available</Typography>
            </Box>
          )}
        </Box>
      </Tooltip>
    </Card>
  );
};

export default HardwareCoverCard;
