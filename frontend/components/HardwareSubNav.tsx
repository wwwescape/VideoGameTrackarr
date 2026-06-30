import { Link, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";

const SUB_NAV_ITEMS = [
  { to: "/hardware", label: "All Hardware" },
  { to: "/hardware/device/add", label: "Add Device" },
  { to: "/hardware/accessory/add", label: "Add Accessory" },
] as const;

// Mirrors GamesSubNav.tsx — keeps Add Device/Add Accessory reachable at every breakpoint,
// since NavDrawer's nested sub-items are desktop-only.
const HardwareSubNav = () => {
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

export default HardwareSubNav;
