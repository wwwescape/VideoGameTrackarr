import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import DarkModeIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeIcon from "@mui/icons-material/LightModeOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTranslation } from "react-i18next";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import OfflineStatusIndicator from "./components/OfflineStatusIndicator";
import RestoreGuard from "./components/RestoreGuard";
import UpdateAvailableChip from "./components/UpdateAvailableChip";
import { useLogout } from "./hooks/useAuth";
import { useScrollResetOnNavigate } from "./hooks/useScrollResetOnNavigate";
import GlobalSearch from "./navigation/GlobalSearch";
import Sidebar, { HEADER_HEIGHT, SIDEBAR_WIDTH } from "./navigation/Sidebar";
import { useColorMode } from "./theme/ColorModeProvider";

// The app shell: a permanent sidebar on desktop (a drawer behind the menu button on phones
// and small tablets) and one slim header with the global search. Each page brings its own
// toolbar and breadcrumbs through components/Page.tsx.
const AppShell = () => {
  const { t } = useTranslation();
  const { mode, toggleColorMode } = useColorMode();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  useScrollResetOnNavigate();

  // A drawer left open on a phone closes when the page changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    // Clearing tokens/cache alone doesn't move the user off the current (now-stale)
    // protected page — ProtectedLayout only re-checks auth on navigation, and nothing
    // here triggers one. Without this, the redirect only happens once some unrelated
    // background request 401s, which can take a while (staleTime is 30s) or never happen
    // at all if nothing refetches.
    logoutMutation.mutate(undefined, { onSuccess: () => navigate("/login") });
  };

  const themeLabel = mode === "dark" ? t("appShell.lightMode") : t("appShell.darkMode");

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <RestoreGuard />
      <Link
        href="#main-content"
        sx={{
          position: "absolute",
          left: -9999,
          top: "auto",
          "&:focus": {
            position: "fixed",
            left: 8,
            top: 8,
            zIndex: (t) => t.zIndex.tooltip,
            p: 1.5,
            bgcolor: "background.paper",
            borderRadius: 1,
          },
        }}
      >
        {t("appShell.skipToMainContent")}
      </Link>

      {isDesktop ? (
        <Box
          component="aside"
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            position: "sticky",
            top: 0,
            height: "100vh",
            borderRight: 1,
            borderColor: "divider",
          }}
        >
          <Sidebar />
        </Box>
      ) : (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          slotProps={{
            paper: { sx: { width: SIDEBAR_WIDTH + 24, borderRight: 1, borderColor: "divider" } },
          }}
        >
          <Sidebar onNavigate={() => setDrawerOpen(false)} />
        </Drawer>
      )}

      <Box sx={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Box
          component="header"
          sx={{
            position: "sticky",
            top: 0,
            zIndex: (t) => t.zIndex.appBar,
            height: HEADER_HEIGHT,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: { xs: 1, sm: 2 },
            bgcolor: "vgt.shell",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          {isDesktop ? null : (
            <IconButton
              onClick={() => setDrawerOpen(true)}
              aria-label={t("appShell.openMenu")}
              title={t("appShell.openMenu")}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1, minWidth: 0, display: "flex" }}>
            <GlobalSearch />
          </Box>
          <OfflineStatusIndicator />
          <UpdateAvailableChip />
          <Tooltip title={themeLabel}>
            <IconButton onClick={toggleColorMode} aria-label={themeLabel}>
              {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title={t("common.logOut")}>
            <IconButton onClick={handleLogout} aria-label={t("common.logOut")}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Box component="main" id="main-content" sx={{ flexGrow: 1, minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>

      <ToastContainer theme="colored" />
    </Box>
  );
};

export default AppShell;
