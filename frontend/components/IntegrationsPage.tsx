import { useEffect, useState, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
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
import SettingsFrame from "./SettingsFrame";
import { SettingRow, SettingsColumn, SettingsGroup } from "./SettingsLayout";

// The store region prices are fetched for (ITAD_COUNTRY / PLATPRICES_REGION), so a region
// that doesn't match what you expect is visible here rather than only in the prices.
const RegionChip = ({ configured, region }: { configured: boolean | undefined; region: string | undefined }) => {
  const { t } = useTranslation();
  if (!configured || !region) return null;
  return (
    <Chip size="small" variant="outlined" label={t("settings.integrations.regionLabel", { region })} />
  );
};

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

  const logo = (src: string, alt: string) => <Box component="img" src={src} alt={alt} sx={{ width: 28, display: "block" }} />;
  const explanation = (node: ReactNode) => (
    <SettingRow stacked>
      <Typography variant="body2" component="div" sx={{ color: "text.secondary", "& code": { fontSize: 12.5 } }}>
        {node}
      </Typography>
    </SettingRow>
  );

  return (
    <SettingsFrame>
      <SettingsColumn>
        <SettingsGroup
          title={
            <Stack direction="row" spacing={1.25} component="span" sx={{ alignItems: "center" }}>
              {logo(igdbLogo, t("settings.integrations.igdbLogoAlt"))}
              <span>{t("settings.integrations.igdbHeading")}</span>
            </Stack>
          }
          aside={<ConfiguredChip configured={status?.igdbConfigured} />}
        >
          {explanation(<Trans i18nKey="settings.integrations.igdbDescription" components={{ 1: <code />, 3: <code />, 5: <code /> }} />)}
        </SettingsGroup>

        <SettingsGroup
          title={
            <Stack direction="row" spacing={1.25} component="span" sx={{ alignItems: "center" }}>
              {logo(steamLogo, t("settings.integrations.steamLogoAlt"))}
              <span>{t("settings.integrations.steamHeading")}</span>
            </Stack>
          }
          aside={<ConfiguredChip configured={status?.steamApiKeyConfigured} />}
        >
          {explanation(<Trans i18nKey="settings.integrations.steamDescription" components={{ 1: <code />, 3: <code /> }} />)}
          <SettingRow name={t("settings.integrations.steamIdLabel")} description={t("settings.integrations.steamIdHelperText")}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <TextField
                label={t("settings.integrations.steamIdLabel")}
                placeholder={t("settings.integrations.steamIdPlaceholder")}
                value={steamId}
                onChange={(e) => {
                  setSteamId(e.target.value);
                  setTouched(true);
                }}
                sx={{ width: { xs: "100%", sm: 260 } }}
              />
              <Button
                variant="contained"
                onClick={handleSaveSteamId}
                disabled={updateSteamId.isPending || steamId === (status?.steamId64 ?? "")}
              >
                {t("common.save")}
              </Button>
            </Box>
          </SettingRow>
        </SettingsGroup>

        <SettingsGroup
          title={
            <Stack direction="row" spacing={1.25} component="span" sx={{ alignItems: "center" }}>
              {logo(itadLogo, t("settings.integrations.itadLogoAlt"))}
              <span>{t("settings.integrations.itadHeading")}</span>
            </Stack>
          }
          aside={
            <>
              <ConfiguredChip configured={status?.itadConfigured} />
              <RegionChip configured={status?.itadConfigured} region={status?.itadCountry} />
            </>
          }
        >
          {explanation(<Trans i18nKey="settings.integrations.itadDescription" components={{ 1: <code />, 3: <code /> }} />)}
        </SettingsGroup>

        <SettingsGroup
          title={
            <Stack direction="row" spacing={1.25} component="span" sx={{ alignItems: "center" }}>
              <Box sx={{ bgcolor: "#161616", borderRadius: 1, px: 1, py: 0.5, display: "flex", alignItems: "center" }}>
                <Box
                  component="img"
                  src={platpricesLogo}
                  alt={t("settings.integrations.platpricesLogoAlt")}
                  sx={{ height: 20, display: "block" }}
                />
              </Box>
              <span>{t("settings.integrations.platpricesHeading")}</span>
            </Stack>
          }
          aside={
            <>
              <ConfiguredChip configured={status?.platpricesConfigured} />
              <RegionChip configured={status?.platpricesConfigured} region={status?.platpricesRegion} />
            </>
          }
        >
          {explanation(<Trans i18nKey="settings.integrations.platpricesDescription" components={{ 1: <code />, 3: <code /> }} />)}
          <SettingRow stacked>
            <Alert severity="warning">{t("settings.integrations.platpricesRegionCaveat")}</Alert>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1.5 }}>
              <Trans
                i18nKey="settings.integrations.platpricesCredit"
                components={{
                  1: <Link href="https://platprices.com" target="_blank" rel="noopener noreferrer" />,
                }}
              />
            </Typography>
          </SettingRow>
        </SettingsGroup>
      </SettingsColumn>
    </SettingsFrame>
  );
};

export default IntegrationsPage;
