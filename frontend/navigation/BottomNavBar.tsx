import { useLocation, useNavigate } from "react-router-dom";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Paper from "@mui/material/Paper";
import { navDestinations } from "./destinations";

export const BOTTOM_NAV_HEIGHT = 64;

const BottomNavBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Paper
      elevation={3}
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        borderRadius: 0,
      }}
    >
      <BottomNavigation
        showLabels
        value={location.pathname}
        onChange={(_event, newValue: string) => navigate(newValue)}
        sx={{ height: BOTTOM_NAV_HEIGHT }}
      >
        {navDestinations.map((destination) => (
          <BottomNavigationAction
            key={destination.to}
            label={destination.label}
            icon={destination.icon}
            value={destination.to}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
};

export default BottomNavBar;
