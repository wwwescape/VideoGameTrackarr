import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import igdbLogo from "../assets/igdb-logo.png";
import itadLogo from "../assets/isthereanydeal-logo.png";
import platpricesLogo from "../assets/platprices-logo.png";
import steamLogo from "../assets/steam-logo.png";
import { useIntegrationsStatus, useUpdateSteamId } from "../hooks/useIntegrations";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import SettingsSubNav from "./SettingsSubNav";

const ConfiguredChip = ({ configured }: { configured: boolean | undefined }) => {
  const { t } = useTranslation();
  if (configured === undefined) return null;
  return (
    <Chip
      size="small"
      label={
        configured
          ? t("settings.integrations.configuredLabel")
          : t("settings.integrations.notConfiguredLabel")
      }
      color={configured ? "success" : "default"}
      variant={configured ? "filled" : "outlined"}
    />
  );
};

const IntegrationsPage = () => {
  const { t } = useTranslation();
  const { data: status } = useIntegrationsStatus();
  const updateSteamId = useUpdateSteamId();
  const [steamId, setSteamId] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    // Only seeds the field from the server value until the user actually edits it — without
    // the `touched` guard, typing before this query resolves gets silently overwritten the
    // moment it does (a real race: the query is often still loading on first paint).
    if (!touched) setSteamId(status?.steamId64 ?? "");
  }, [status?.steamId64, touched]);

  const handleSaveSteamId = async () => {
    try {
      await updateSteamId.mutateAsync(steamId.trim() === "" ? null : steamId.trim());
      setTouched(false);
      toast.success(t("settings.integrations.saveSuccessToast"), TOAST_OPTIONS);
    } catch (error) {
      console.error("Error saving Steam ID:", error);
      toast.error(t("settings.integrations.saveErrorToast"), TOAST_OPTIONS);
    }
  };

  return (
    <>
      <SettingsSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("nav.integrations")}
        </Typography>
      </Box>
      <Card sx={{ maxWidth: 640 }}>
        <CardContent>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1.5 }}>
            <Box
              component="img"
              src={igdbLogo}
              alt={t("settings.integrations.igdbLogoAlt")}
              sx={{ width: 32 }}
            />
            <Typography variant="subtitle1">{t("settings.integrations.igdbHeading")}</Typography>
            <ConfiguredChip configured={status?.igdbConfigured} />
          </Stack>
          <Alert severity="info">
            <Trans
              i18nKey="settings.integrations.igdbDescription"
              components={{ 1: <code />, 3: <code />, 5: <code /> }}
            />
          </Alert>

          <Divider sx={{ my: 3 }} />

          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1.5 }}>
            <Box
              component="img"
              src={steamLogo}
              alt={t("settings.integrations.steamLogoAlt")}
              sx={{ width: 32 }}
            />
            <Typography variant="subtitle1">{t("settings.integrations.steamHeading")}</Typography>
            <ConfiguredChip configured={status?.steamApiKeyConfigured} />
          </Stack>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Trans
              i18nKey="settings.integrations.steamDescription"
              components={{ 1: <code />, 3: <code /> }}
            />
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t("settings.integrations.steamIdHelperText")}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <TextField
              label={t("settings.integrations.steamIdLabel")}
              placeholder={t("settings.integrations.steamIdPlaceholder")}
              value={steamId}
              onChange={(e) => {
                setSteamId(e.target.value);
                setTouched(true);
              }}
              sx={{ minWidth: 280 }}
            />
            <Button
              variant="contained"
              onClick={handleSaveSteamId}
              disabled={updateSteamId.isPending || steamId === (status?.steamId64 ?? "")}
            >
              {t("common.save")}
            </Button>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1.5 }}>
            <Box
              component="img"
              src={itadLogo}
              alt={t("settings.integrations.itadLogoAlt")}
              sx={{ width: 32 }}
            />
            <Typography variant="subtitle1">{t("settings.integrations.itadHeading")}</Typography>
            <ConfiguredChip configured={status?.itadConfigured} />
          </Stack>
          <Alert severity="info">
            <Trans
              i18nKey="settings.integrations.itadDescription"
              components={{ 1: <code />, 3: <code /> }}
            />
          </Alert>

          <Divider sx={{ my: 3 }} />

          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1.5 }}>
            <Box
              sx={{
                bgcolor: "#161616",
                borderRadius: 1,
                px: 1,
                py: 0.5,
                display: "flex",
                alignItems: "center",
              }}
            >
              <Box
                component="img"
                src={platpricesLogo}
                alt={t("settings.integrations.platpricesLogoAlt")}
                sx={{ height: 22, display: "block" }}
              />
            </Box>
            <Typography variant="subtitle1">
              {t("settings.integrations.platpricesHeading")}
            </Typography>
            <ConfiguredChip configured={status?.platpricesConfigured} />
          </Stack>
          <Alert severity="info" sx={{ mb: 1.5 }}>
            <Trans
              i18nKey="settings.integrations.platpricesDescription"
              components={{ 1: <code />, 3: <code /> }}
            />
          </Alert>
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            {t("settings.integrations.platpricesRegionCaveat")}
          </Alert>
          <Typography variant="caption" color="text.secondary">
            <Trans
              i18nKey="settings.integrations.platpricesCredit"
              components={{
                1: <Link href="https://platprices.com" target="_blank" rel="noopener noreferrer" />,
              }}
            />
          </Typography>
        </CardContent>
      </Card>
    </>
  );
};

export default IntegrationsPage;
