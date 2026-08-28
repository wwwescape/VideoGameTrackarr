import { Link, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { useTranslation } from "react-i18next";

const SUB_NAV_ITEMS = [
  { to: "/settings", labelKey: "settings.subNav.overview" },
  { to: "/settings/tags", labelKey: "nav.tagManager" },
  { to: "/settings/jobs", labelKey: "nav.jobs" },
] as const;

// Mirrors InsightsSubNav.tsx — keeps Tag Manager/Jobs reachable at every breakpoint, since
// NavDrawer's nested sub-items are desktop-only.
const SettingsSubNav = () => {
  const { t } = useTranslation();
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

export default SettingsSubNav;
