import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Chip from "@mui/material/Chip";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { resolveAssetUrl } from "../api/client";
import OwnershipBadges from "./OwnershipBadges";

interface HardwareCardProps {
  name: string;
  subtitle: string | null;
  imageUrl: string | null;
  owned: boolean;
  wishlisted: boolean;
  ownedQuantity: number;
  onClick: () => void;
}

// Shared by Hardware and Accessory grids — same shape of info (name, a one-line
// subtitle, owned/wishlist badges, a quantity chip) but neither maps cleanly onto
// GameCard's game-specific fields (release year, play status, addon type), so this is
// its own component rather than a GameCard reuse.
const HardwareCard = ({ name, subtitle, imageUrl, owned, wishlisted, ownedQuantity, onClick }: HardwareCardProps) => {
  const theme = useTheme();

  return (
    <Card
      sx={{
        position: "relative",
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: "pointer",
        transition: "transform 150ms ease, box-shadow 150ms ease",
        "&:hover": { transform: "translateY(-2px)", boxShadow: theme.shadows[6] },
      }}
      onClick={onClick}
    >
      <OwnershipBadges owned={owned} wishlisted={wishlisted} />

      <Box
        sx={{
          position: "relative",
          aspectRatio: "4 / 3",
          overflow: "hidden",
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
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
              alignItems: "center",
              justifyContent: "center",
              p: 2,
              textAlign: "center",
            }}
          >
            <Typography variant="caption">No image</Typography>
          </Box>
        )}
      </Box>

      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Tooltip title={name}>
          <Typography
            variant="subtitle2"
            component="div"
            sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            <strong>{name}</strong>
          </Typography>
        </Tooltip>
        <Typography
          variant="caption"
          color="text.secondary"
          component="div"
          sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {subtitle ?? " "}
        </Typography>
        {owned && ownedQuantity > 1 ? <Chip label={`x${ownedQuantity}`} size="small" sx={{ mt: 0.75 }} /> : null}
      </CardContent>
    </Card>
  );
};

export default HardwareCard;
