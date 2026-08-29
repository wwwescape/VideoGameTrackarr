import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

// The router's top-level errorElement — catches an actual render-time crash anywhere in the
// tree (not unmatched routes; those are handled by AppShell's own "*" route/NotFoundPage
// instead, so they keep the app's nav/header). Renders outside AppShell entirely, since the
// crash may have happened inside AppShell itself, so this stays a bare centered page.
const RouteErrorBoundary = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", p: 3 }}>
      <Paper sx={{ p: 4, textAlign: "center", maxWidth: 480 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          {is404 ? t("errors.pageNotFoundTitle") : t("errors.unexpectedErrorTitle")}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {is404 ? t("errors.pageNotFoundMessage") : t("errors.unexpectedErrorMessage")}
        </Typography>
        <Button variant="contained" onClick={() => navigate("/")}>
          {t("errors.backToDashboard")}
        </Button>
      </Paper>
    </Box>
  );
};

export default RouteErrorBoundary;
