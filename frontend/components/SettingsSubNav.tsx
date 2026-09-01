import { Link, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import { useTranslation } from "react-i18next";

const SUB_NAV_ITEMS = [
  { to: "/settings", labelKey: "settings.subNav.overview" },
  { to: "/settings/tags", labelKey: "nav.tagManager" },
  { to: "/settings/jobs", labelKey: "nav.jobs" },
  { to: "/settings/integrations", labelKey: "nav.integrations" },
  // Separate from the rest — this is the one item here that isn't app configuration, it's
  // the Steam library sync workflow, which just happens to live under Settings now.
  { to: "/settings/steam-sync", labelKey: "nav.steamSync", separatorBefore: true },
] as const;

// Mirrors InsightsSubNav.tsx — keeps Tag Manager/Jobs/Integrations/Steam Sync reachable at
// every breakpoint, since NavDrawer's nested sub-items are desktop-only.
const SettingsSubNav = () => {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 3 }}>
      {SUB_NAV_ITEMS.map((item) => {
        const isSelected = location.pathname === item.to;
        return (
          <Box key={item.to} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {"separatorBefore" in item && item.separatorBefore ? (
              <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
            ) : null}
            <Chip
              component={Link}
              to={item.to}
              label={t(item.labelKey)}
              clickable
              color={isSelected ? "primary" : "default"}
              variant={isSelected ? "filled" : "outlined"}
            />
          </Box>
        );
      })}
    </Box>
  );
};

export default SettingsSubNav;
