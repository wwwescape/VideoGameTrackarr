import { Link, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";

const SUB_NAV_ITEMS = [
  { to: "/games", label: "All Games" },
  { to: "/games/add", label: "Add Game" },
  { to: "/games/collections", label: "Collections" },
  { to: "/games/series", label: "Series" },
] as const;

// Route-driven segmented control shown atop Games/Collections/Series — these pages form
// one logical section, so the same switcher renders identically on each, regardless of
// breakpoint (NavDrawer/NavRail/BottomNavBar no longer list Collections/Series directly).
const GamesSubNav = () => {
  const location = useLocation();

  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
      {SUB_NAV_ITEMS.map((item) => {
        const isSelected = location.pathname === item.to;
        return (
          <Chip
            key={item.to}
            component={Link}
            to={item.to}
            label={item.label}
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
