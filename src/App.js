import React, { useEffect } from "react";
import axios from "axios";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { styled } from "@mui/material/styles";
import {
  createTheme,
  ThemeProvider,
  responsiveFontSizes,
} from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import Box from "@mui/material/Box";
import MuiDrawer from "@mui/material/Drawer";
import MuiAppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import List from "@mui/material/List";
import CssBaseline from "@mui/material/CssBaseline";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Button from "@mui/material/Button";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import GamesIcon from "@mui/icons-material/Games";
import SettingsIcon from "@mui/icons-material/Settings";
import AddIcon from "@mui/icons-material/Add";
import Grid from "@mui/material/Grid";
import { useTheme } from "@mui/material/styles";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import GameList from "./components/GameList";
import GameDetails from "./components/GameDetails";
import AddGame from "./components/AddGame";
import Settings from "./components/Settings";

const drawerWidth = 240;

const openedMixin = (theme) => ({
  width: drawerWidth,
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: "hidden",
});

const closedMixin = (theme) => ({
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: "hidden",
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up("sm")]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
}));

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== "open",
})(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(["width", "margin"], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== "open",
})(({ theme, open }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  ...(open && {
    ...openedMixin(theme),
    "& .MuiDrawer-paper": openedMixin(theme),
  }),
  ...(!open && {
    ...closedMixin(theme),
    "& .MuiDrawer-paper": closedMixin(theme),
  }),
}));

const SidebarItem = ({ to, icon, text, open }) => {
  const theme = useTheme();
  const location = useLocation();
  const isSelected = location.pathname === to;

  return (
    <ListItem
      key={text}
      disablePadding
      sx={{ display: "block" }}
      component={Link}
      to={to}
    >
      <ListItemButton
        sx={{
          minHeight: 48,
          justifyContent: open ? "initial" : "center",
          px: 2.5,
        }}
        selected={isSelected}
      >
        <ListItemIcon
          sx={{
            minWidth: 0,
            mr: open ? 3 : "auto",
            justifyContent: "center",
          }}
        >
          {icon}
        </ListItemIcon>
        <ListItemText
          primary={text}
          sx={{ opacity: open ? 1 : 0, color: theme.palette.text.primary }}
        />
      </ListItemButton>
    </ListItem>
  );
};

const ColorModeContext = React.createContext({ toggleColorMode: () => {} });

function App() {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const [mode, setMode] = React.useState();
  const [themeSwitch, setThemeSwitch] = React.useState(prefersDarkMode);
  const igdbErrorToast = React.useRef(null);

  React.useEffect(() => {
    setMode(prefersDarkMode ? "dark" : "light");
  }, [prefersDarkMode]);

  const colorMode = React.useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
      },
    }),
    []
  );

  const handleThemeSwitch = () => {
    setThemeSwitch((prev) => !prev);
    setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
  };

  let theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode,
        },
      }),
    [mode]
  );

  theme = responsiveFontSizes(theme);

  const [open, setOpen] = React.useState(false);

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  useEffect(() => {
    // Attempt IGDB authentication when the component mounts
    authenticateIGDB();
  }, []); // Empty dependency array ensures it runs only once on mount

  const closeIGDBErrorToast = () => {
    toast.dismiss(igdbErrorToast.current);
  }

  const authenticateIGDB = async (responses) => {
    try {
      // Make a request to your backend API for IGDB authentication
      await axios.post("http://localhost:3001/api/igdb/auth");
    } catch (error) {
      console.error("Error authenticating with IGDB:", error.response);

      igdbErrorToast.current = toast.error(
        <Grid
          container
          spacing={2}
          direction="row"
          justifyContent="center"
          alignItems="center"
        >
          <Grid item>
            <Typography variant="h6" noWrap align="center">
              {error?.response?.data?.error}
            </Typography>
            <Link to={"/settings"}>
              <Button variant="contained" color="primary" fullWidth>
                Setup now!
              </Button>
            </Link>
          </Grid>
        </Grid>,
        {
          position: "top-right",
          autoClose: false,
          hideProgressBar: true,
          closeOnClick: false,
          closeButton: false,
        }
      );
    }
  };

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <Router>
          <Box sx={{ display: "flex" }}>
            <CssBaseline />
            <AppBar position="fixed" open={open}>
              <Toolbar>
                <IconButton
                  color="inherit"
                  aria-label="open drawer"
                  onClick={handleDrawerOpen}
                  edge="start"
                  sx={{
                    marginRight: 5,
                    ...(open && { display: "none" }),
                  }}
                >
                  <MenuIcon />
                </IconButton>
                <Typography variant="h6" noWrap component="div">
                  VideoGameTrackarr
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={themeSwitch}
                      onChange={handleThemeSwitch}
                    />
                  }
                  label="Dark Mode"
                  sx={{ ml: "auto" }}
                />
              </Toolbar>
            </AppBar>
            <Drawer variant="permanent" open={open}>
              <DrawerHeader>
                <IconButton onClick={handleDrawerClose}>
                  {theme.direction === "rtl" ? (
                    <ChevronRightIcon />
                  ) : (
                    <ChevronLeftIcon />
                  )}
                </IconButton>
              </DrawerHeader>
              <Divider />
              <List>
                <SidebarItem
                  to={"/"}
                  icon={<GamesIcon />}
                  text={"Home"}
                  open={open}
                />
                <SidebarItem
                  to={"/games/add"}
                  icon={<AddIcon />}
                  text={"Add Game"}
                  open={open}
                />
              </List>
              <Divider />
              <List>
                <SidebarItem
                  to={"/settings"}
                  icon={<SettingsIcon />}
                  text={"Settings"}
                  open={open}
                />
              </List>
            </Drawer>
            <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
              <DrawerHeader />
              <Routes>
                <Route path="/" element={<GameList />} />
                <Route path="/games" element={<GameList />} />
                <Route path="/games/add" element={<AddGame />} />
                <Route
                  path="/game/:gameOrAddonId/:tab?"
                  element={<GameDetails />}
                />
                <Route
                  path="/addon/:gameOrAddonId/:tab?"
                  element={<GameDetails />}
                />
                <Route path="/settings" element={<Settings closeIGDBErrorToast={closeIGDBErrorToast} />} />
              </Routes>
            </Box>
          </Box>
          <ToastContainer theme="colored" />
        </Router>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;
