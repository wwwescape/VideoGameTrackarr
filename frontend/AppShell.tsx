import { Outlet, useNavigate } from "react-router-dom";
import LogoutIcon from "@mui/icons-material/Logout";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Switch from "@mui/material/Switch";
import { useTheme } from "@mui/material/styles";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import OfflineStatusIndicator from "./components/OfflineStatusIndicator";
import { useLogout } from "./hooks/useAuth";
import BottomNavBar, { BOTTOM_NAV_HEIGHT } from "./navigation/BottomNavBar";
import Breadcrumbs, { BREADCRUMBS_HEIGHT } from "./navigation/Breadcrumbs";
import NavDrawer, { NAV_DRAWER_WIDTH } from "./navigation/NavDrawer";
import NavRail, { NAV_RAIL_WIDTH } from "./navigation/NavRail";
import { useColorMode } from "./theme/ColorModeProvider";

// M3's three responsive navigation patterns: Navigation Bar (compact/mobile, bottom),
// Navigation Rail (medium/tablet, icons-only side rail), Navigation Drawer
// (expanded/desktop, icons+labels side panel) — picked by breakpoint, not a user toggle.
// The old mini-variant collapsible drawer (M2-style, manually opened/closed) is gone.
const AppShell = () => {
  const { mode, toggleColorMode } = useColorMode();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("sm"));
  const isExpanded = useMediaQuery(theme.breakpoints.up("lg"));
  const navigate = useNavigate();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    // Clearing tokens/cache alone doesn't move the user off the current (now-stale)
    // protected page — ProtectedLayout only re-checks auth on navigation, and nothing
    // here triggers one. Without this, the redirect only happens once some unrelated
    // background request 401s, which can take a while (staleTime is 30s) or never happen
    // at all if nothing refetches.
    logoutMutation.mutate(undefined, { onSuccess: () => navigate("/login") });
  };

  const sideNavWidth = isCompact ? 0 : isExpanded ? NAV_DRAWER_WIDTH : NAV_RAIL_WIDTH;
  // Mirrors MUI's default Toolbar breakpoint (56px below `sm`, 64px at `sm` and up) so the
  // breadcrumb bar docks flush under the fixed AppBar with no gap or overlap.
  const appBarHeight = isCompact ? 56 : 64;

  return (
    <Box sx={{ display: "flex" }}>
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
        Skip to main content
      </Link>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Box
            component="img"
            src="/icon-master.svg"
            alt=""
            sx={{ height: 44, width: 44, mr: 1.5 }}
          />
          <Typography variant="h6" component="div" noWrap sx={{ minWidth: 0, flexGrow: 1 }}>
            VideoGameTrackarr
          </Typography>
          <OfflineStatusIndicator />
          <FormControlLabel
            control={<Switch checked={mode === "dark"} onChange={toggleColorMode} />}
            label="Dark Mode"
            sx={{
              mr: 1,
              ".MuiFormControlLabel-label": { display: { xs: "none", sm: "block" } },
            }}
          />
          <IconButton color="inherit" onClick={handleLogout} title="Log out" aria-label="Log out">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Breadcrumbs top={appBarHeight} left={sideNavWidth} />

      {isCompact ? null : isExpanded ? <NavDrawer /> : <NavRail />}

      <Box
        component="main"
        id="main-content"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: { sm: `calc(100% - ${sideNavWidth}px)` },
          p: { xs: 1.5, sm: 2, md: 3 },
          pb: isCompact ? `${BOTTOM_NAV_HEIGHT + 24}px` : undefined,
        }}
      >
        <Toolbar />
        <Box sx={{ height: BREADCRUMBS_HEIGHT }} />
        <Outlet />
      </Box>

      {isCompact ? <BottomNavBar /> : null}
      <ToastContainer theme="colored" />
    </Box>
  );
};

export default AppShell;
