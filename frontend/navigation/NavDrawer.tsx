import { Link, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { navDestinations } from "./destinations";

export const NAV_DRAWER_WIDTH = 240;

// Matches AppShell's non-compact Toolbar height — NavDrawer only renders when !isCompact.
const APP_BAR_HEIGHT = 64;

const NavDrawer = () => {
  const location = useLocation();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: NAV_DRAWER_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: NAV_DRAWER_WIDTH,
          boxSizing: "border-box",
          border: "none",
          // Start below the fixed AppBar and cap height to the rest of the viewport, so if
          // nav content overflows, it gets its own scrollbar confined to this region —
          // instead of scrolling content up underneath the (higher z-index) AppBar, where
          // it'd be invisible rather than just scrolled past.
          top: APP_BAR_HEIGHT,
          height: `calc(100% - ${APP_BAR_HEIGHT}px)`,
        },
      }}
    >
      <List component="nav" aria-label="Primary" sx={{ px: 1.5 }}>
        {navDestinations.map((destination) => {
          const isSelected = location.pathname === destination.to;
          return (
            <Box key={destination.to}>
              <ListItem disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component={Link}
                  to={destination.to}
                  selected={isSelected}
                  aria-current={isSelected ? "page" : undefined}
                  sx={{ borderRadius: 999 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>{destination.icon}</ListItemIcon>
                  <ListItemText primary={destination.label} />
                </ListItemButton>
              </ListItem>
              {destination.subItems?.map((sub) => {
                const isSubSelected = location.pathname === sub.to;
                return (
                  <ListItem key={sub.to} disablePadding sx={{ mb: 0.5, pl: 2 }}>
                    <ListItemButton
                      component={Link}
                      to={sub.to}
                      selected={isSubSelected}
                      aria-current={isSubSelected ? "page" : undefined}
                      sx={{ borderRadius: 999 }}
                      dense
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>{sub.icon}</ListItemIcon>
                      <ListItemText primary={sub.label} slotProps={{ primary: { variant: "body2" } }} />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </Box>
          );
        })}
      </List>
    </Drawer>
  );
};

export default NavDrawer;
