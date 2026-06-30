import { Link, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Typography from "@mui/material/Typography";
import { navDestinations } from "./destinations";

export const NAV_RAIL_WIDTH = 80;

const NavRail = () => {
  const location = useLocation();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: NAV_RAIL_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": { width: NAV_RAIL_WIDTH, boxSizing: "border-box", border: "none" },
      }}
    >
      <Box sx={{ height: (theme) => theme.mixins.toolbar.minHeight }} />
      <Box component="nav" aria-label="Primary" sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, pt: 2 }}>
        {navDestinations.map((destination) => {
          const isSelected = location.pathname === destination.to;
          return (
            <Box
              key={destination.to}
              component={Link}
              to={destination.to}
              aria-current={isSelected ? "page" : undefined}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.5,
                textDecoration: "none",
                color: isSelected ? "primary.main" : "text.secondary",
                width: 56,
                py: 0.5,
                borderRadius: 2,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 56,
                  height: 32,
                  borderRadius: 999,
                  bgcolor: isSelected ? "m3.secondaryContainer" : "transparent",
                }}
              >
                {destination.icon}
              </Box>
              <Typography variant="caption" sx={{ fontSize: "0.6875rem" }}>
                {destination.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Drawer>
  );
};

export default NavRail;
