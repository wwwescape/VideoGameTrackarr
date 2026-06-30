import CheckIcon from "@mui/icons-material/Check";
import FavoriteIcon from "@mui/icons-material/Favorite";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";

interface OwnershipBadgesProps {
  owned: boolean;
  wishlisted: boolean;
}

const BADGE_SIZE = 30;

// Floating tonal badges shared by GameCoverCard and HardwareCard. Both use the tertiary
// container role (colors come from the app's seed-derived M3 palette in createM3Theme.ts
// rather than hardcoded red/green) so owned/wishlisted read as one consistent badge family
// — distinguished by icon, not by hue — in both light and dark mode. Primary container was
// tried for "owned" but its chroma diverges from tertiary's enough in dark mode to look
// like a mismatched pair.
const OwnershipBadges = ({ owned, wishlisted }: OwnershipBadgesProps) => {
  const theme = useTheme();

  return (
    <>
      {wishlisted ? (
        <Box
          sx={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 1,
            width: BADGE_SIZE,
            height: BADGE_SIZE,
            borderRadius: theme.m3Shape.full,
            bgcolor: theme.palette.m3.tertiaryContainer,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: theme.shadows[3],
          }}
        >
          <Tooltip title="On your wishlist">
            <FavoriteIcon sx={{ fontSize: 17, color: theme.palette.m3.onTertiaryContainer }} />
          </Tooltip>
        </Box>
      ) : null}
      {owned ? (
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 1,
            width: BADGE_SIZE,
            height: BADGE_SIZE,
            borderRadius: theme.m3Shape.full,
            bgcolor: theme.palette.m3.tertiaryContainer,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: theme.shadows[3],
          }}
        >
          <Tooltip title="In your collection">
            <CheckIcon sx={{ fontSize: 19, color: theme.palette.m3.onTertiaryContainer }} />
          </Tooltip>
        </Box>
      ) : null}
    </>
  );
};

export default OwnershipBadges;
