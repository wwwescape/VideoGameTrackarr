import { Link, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { useTranslation } from "react-i18next";

const SUB_NAV_ITEMS = [
  { to: "/games", labelKey: "games.subNav.allGames" },
  { to: "/games/add", labelKey: "games.subNav.addGame" },
  { to: "/games/collections", labelKey: "games.subNav.collections" },
  { to: "/games/series", labelKey: "games.subNav.series" },
] as const;

// Route-driven segmented control shown atop Games/Collections/Series — these pages form
// one logical section, so the same switcher renders identically on each, regardless of
// breakpoint (NavDrawer/NavRail/BottomNavBar no longer list Collections/Series directly).
const GamesSubNav = () => {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
      {SUB_NAV_ITEMS.map((item) => {
        const isSelected = location.pathname === item.to;
        return (
          <Chip
            key={item.to}
            component={Link}
            to={item.to}
            label={t(item.labelKey)}
            clickable
            color={isSelected ? "primary" : "default"}
            variant={isSelected ? "filled" : "outlined"}
          />
        );
      })}
    </Box>
  );
};

export default GamesSubNav;
