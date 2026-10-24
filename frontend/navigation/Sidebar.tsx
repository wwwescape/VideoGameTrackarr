import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useDashboardStats } from "../hooks/useDashboard";
import { useHardwareStats } from "../hooks/useHardwareStats";
import { useVersion } from "../hooks/useVersion";
import { isInSection, isPathWithin, navGroups, type NavDestination } from "./destinations";

export const SIDEBAR_WIDTH = 240;
export const HEADER_HEIGHT = 56;

interface NavLinkProps {
  to: string;
  label: string;
  icon?: ReactNode;
  selected: boolean;
  sub?: boolean;
  separatorBefore?: boolean;
  count?: number;
  onNavigate?: () => void;
}

const NavLink = ({
  to,
  label,
  icon,
  selected,
  sub = false,
  separatorBefore = false,
  count,
  onNavigate,
}: NavLinkProps) => (
  <ButtonBase
    component={Link}
    to={to}
    onClick={onNavigate}
    aria-current={selected ? "page" : undefined}
    sx={{
      position: "relative",
      width: "100%",
      justifyContent: "flex-start",
      gap: sub ? 1.25 : 1.5,
      px: 1.25,
      py: sub ? 0.625 : 0.875,
      pl: sub ? 4 : 1.25,
      my: "1px",
      mt: separatorBefore ? 1 : "1px",
      borderRadius: 1.5,
      typography: sub ? "body2" : "subtitle2",
      fontWeight: sub ? 500 : 550,
      color: selected ? "text.primary" : "text.secondary",
      bgcolor: selected ? "vgt.accentSoft" : "transparent",
      "&:hover": {
        bgcolor: selected ? "vgt.accentSoft" : "vgt.surfaceHover",
        color: "text.primary",
      },
      "& svg": { fontSize: sub ? 17 : 20, color: selected ? "primary.main" : "inherit" },
      "&::before": selected
        ? {
            content: '""',
            position: "absolute",
            left: -10,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: "0 3px 3px 0",
            bgcolor: "primary.main",
          }
        : undefined,
      "&::after": separatorBefore
        ? {
            content: '""',
            position: "absolute",
            left: 32,
            right: 10,
            top: -5,
            height: "1px",
            bgcolor: "divider",
          }
        : undefined,
    }}
  >
    {icon}
    <Box component="span" sx={{ flexGrow: 1, textAlign: "left" }}>
      {label}
    </Box>
    {count !== undefined ? (
      <Box
        component="span"
        sx={{
          fontSize: 11,
          fontWeight: 600,
          color: "vgt.text3",
          bgcolor: "vgt.surface2",
          px: 0.875,
          borderRadius: 2.5,
          lineHeight: "18px",
        }}
      >
        {count}
      </Box>
    ) : null}
  </ButtonBase>
);

interface SidebarProps {
  // Phones: the drawer closes after a link is followed.
  onNavigate?: () => void;
}

// The app's one navigation surface: grouped sections, sub-pages that appear under their
// parent while you're inside it, and a quiet footer with the version.
const Sidebar = ({ onNavigate }: SidebarProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { data: dashboardStats } = useDashboardStats();
  const { data: hardwareStats } = useHardwareStats();
  const { data: version } = useVersion();
  const counts = {
    games: dashboardStats?.totalTracked,
    hardware: hardwareStats
      ? hardwareStats.ownedConsoles +
        hardwareStats.ownedAccessories +
        hardwareStats.wishlistHardware
      : undefined,
  };

  const isActive = (item: NavDestination) => {
    // A sub-page you're on is highlighted instead of its parent.
    const onSub = item.subItems?.some((sub) => isPathWithin(pathname, sub.to));
    return !onSub && isInSection(pathname, item);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "vgt.shell" }}>
      <Box
        component={Link}
        to="/"
        onClick={onNavigate}
        sx={{
          height: HEADER_HEIGHT,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 2,
          borderBottom: 1,
          borderColor: "divider",
          color: "text.primary",
          textDecoration: "none",
        }}
      >
        <Box component="img" src="/icon-master.svg" alt="" sx={{ width: 30, height: 30 }} />
        <Typography
          variant="subtitle2"
          noWrap
          sx={{ fontWeight: 650, fontSize: 14, letterSpacing: "-0.01em" }}
        >
          VideoGameTrackarr
        </Typography>
      </Box>
      <Box
        component="nav"
        aria-label={t("nav.primary")}
        sx={{ px: 1.25, pb: 2, overflowY: "auto", flexGrow: 1 }}
      >
        {navGroups.map((group) => (
          <Box key={group.labelKey}>
            <Typography
              variant="overline"
              component="div"
              sx={{ color: "vgt.text3", px: 1.25, pt: 1.75, pb: 0.5 }}
            >
              {t(group.labelKey)}
            </Typography>
            {group.items.map((item) => {
              const inside = item.to !== "/" && isInSection(pathname, item);
              return (
                <Box key={item.to}>
                  <NavLink
                    to={item.to}
                    label={t(item.labelKey)}
                    icon={item.icon}
                    selected={isActive(item)}
                    count={item.count ? counts[item.count] : undefined}
                    onNavigate={onNavigate}
                  />
                  {inside
                    ? item.subItems?.map((sub) => (
                        <NavLink
                          key={sub.to}
                          to={sub.to}
                          label={t(sub.labelKey)}
                          icon={sub.icon}
                          selected={isPathWithin(pathname, sub.to)}
                          separatorBefore={sub.separatorBefore}
                          sub
                          onNavigate={onNavigate}
                        />
                      ))
                    : null}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
      <Typography
        variant="caption"
        sx={{ color: "vgt.text3", px: 2.25, py: 1.25, borderTop: 1, borderColor: "divider" }}
      >
        {version?.currentVersion ? `v${version.currentVersion}` : "VideoGameTrackarr"}
      </Typography>
    </Box>
  );
};

export default Sidebar;
