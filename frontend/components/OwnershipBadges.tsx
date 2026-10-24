import CheckIcon from "@mui/icons-material/Check";
import FavoriteIcon from "@mui/icons-material/Favorite";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";

interface OwnershipBadgesProps {
  owned: boolean;
  wishlisted: boolean;
}

const BADGE_SIZE = 30;

// Theme-path colors ("vgt.glass") resolve only when a badge is actually drawn, so cards
// rendered without the app theme (search results, tests) never need the app's tokens.
const badgeSx = {
  position: "absolute",
  top: 7,
  zIndex: 1,
  width: BADGE_SIZE,
  height: BADGE_SIZE,
  borderRadius: "50%",
  bgcolor: "vgt.glass",
  border: 1,
  borderColor: "vgt.glassLine",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
} as const;

// Floating badges shared by GameCoverCard and HardwareCard: a heart (wishlisted, top-left)
// and a check (owned, top-right). They sit on cover art and product shots, so both use the
// theme's dark glass in light and dark mode and are told apart by icon and its color.
const OwnershipBadges = ({ owned, wishlisted }: OwnershipBadgesProps) => {
  const { t } = useTranslation();

  return (
    <>
      {wishlisted ? (
        <Box sx={{ ...badgeSx, left: 7 }}>
          <Tooltip title={t("ownershipBadges.wishlistTooltip")}>
            <FavoriteIcon sx={{ fontSize: 17, color: "vgt.wishlist" }} />
          </Tooltip>
        </Box>
      ) : null}
      {owned ? (
        <Box sx={{ ...badgeSx, right: 7 }}>
          <Tooltip title={t("ownershipBadges.ownedTooltip")}>
            <CheckIcon sx={{ fontSize: 19, color: "#6ee7a8" }} />
          </Tooltip>
        </Box>
      ) : null}
    </>
  );
};

export default OwnershipBadges;
