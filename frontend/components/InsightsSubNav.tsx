import { Link, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";

const SUB_NAV_ITEMS = [
  { to: "/insights", label: "Overview" },
  { to: "/insights/duplicates", label: "Duplicates" },
  { to: "/insights/missing-dlc", label: "Missing DLC" },
  { to: "/insights/orphaned-accessories", label: "Orphaned Accessories" },
] as const;

// Mirrors GamesSubNav.tsx — keeps Duplicates/Missing DLC/Orphaned Accessories reachable at
// every breakpoint, since NavDrawer's nested sub-items are desktop-only.
const InsightsSubNav = () => {
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

export default InsightsSubNav;
