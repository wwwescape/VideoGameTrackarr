import { Outlet } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import PublicSubNav from "./components/PublicSubNav";
import { useColorMode } from "./theme/ColorModeProvider";

// Deliberately minimal, not a stripped-down AppShell — no logout/user menu (there's no
// login on this surface), no side nav rail/drawer (just 2 destinations, handled by
// PublicSubNav below). Read-only pages don't need the offline/update/toast chrome either.
const PublicShell = () => {
  const { t } = useTranslation();
  const { mode, toggleColorMode } = useColorMode();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="fixed">
        <Toolbar>
          <Box component="img" src="/icon-master.svg" alt="" sx={{ height: 44, width: 44, mr: 1.5 }} />
          <Typography variant="h6" component="div" noWrap sx={{ minWidth: 0, flexGrow: 1 }}>
            VideoGameTrackarr
          </Typography>
          <FormControlLabel
            control={<Switch checked={mode === "dark"} onChange={toggleColorMode} />}
            label={t("appShell.darkMode")}
            sx={{ ".MuiFormControlLabel-label": { display: { xs: "none", sm: "block" } } }}
          />
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 1.5, sm: 2, md: 3 } }}>
        <Toolbar />
        <PublicSubNav />
        <Outlet />
      </Box>
    </Box>
  );
};

export default PublicShell;
