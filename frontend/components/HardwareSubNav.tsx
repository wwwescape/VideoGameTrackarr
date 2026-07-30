import { Link, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { useTranslation } from "react-i18next";

// Mirrors GamesSubNav.tsx — keeps Add Device/Add Accessory reachable at every breakpoint,
// since NavDrawer's nested sub-items are desktop-only.
const HardwareSubNav = () => {
  const { t } = useTranslation();
  const location = useLocation();

  const subNavItems = [
    { to: "/hardware", label: t("hardware.subNav.allHardware") },
    { to: "/hardware/device/add", label: t("hardware.subNav.addDevice") },
    { to: "/hardware/accessory/add", label: t("hardware.subNav.addAccessory") },
  ] as const;

  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
      {subNavItems.map((item) => {
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
