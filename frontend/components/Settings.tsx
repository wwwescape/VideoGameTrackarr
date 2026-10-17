import LogoutIcon from "@mui/icons-material/Logout";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { Trans, useTranslation } from "react-i18next";
import { useCurrentUser, useLogout } from "../hooks/useAuth";
import { useColorMode } from "../theme/ColorModeProvider";
import { useCurrency } from "../theme/CurrencyProvider";
import { useLanguage } from "../theme/LanguageProvider";
import { useStoreRegion } from "../theme/StoreRegionProvider";
import { getCurrencySymbol, SUPPORTED_CURRENCIES, type CurrencyOption } from "../utils/currency";
import { SUPPORTED_LANGUAGES, type LanguageOption } from "../utils/language";
import { STORE_REGION_AUTO, STORE_REGION_OFF, STORE_REGIONS } from "../utils/storeRegion";
import AccentColorSetting from "./AccentColorSetting";
import AutocompleteSelect from "./AutocompleteSelect";
import DataManagementSection from "./DataManagementSection";
import SettingsSubNav from "./SettingsSubNav";
import ShareSection from "./ShareSection";

const Settings = () => {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUser();
  const logoutMutation = useLogout();
  const { mode, contrast, toggleColorMode, toggleContrast } = useColorMode();
  const { currency, setCurrency } = useCurrency();
  const { language, setLanguage } = useLanguage();
  const { setting: storeRegion, setSetting: setStoreRegion, detectedRegion } = useStoreRegion();

  // Country names in VGT's own language, via the browser's built-in region names.
  const regionNames = new Intl.DisplayNames([language], { type: "region" });
  const regionName = (code: string) => regionNames.of(code) ?? code;
  const storeRegionOptions = [
    STORE_REGION_AUTO,
    STORE_REGION_OFF,
    ...Object.keys(STORE_REGIONS).sort((a, b) => regionName(a).localeCompare(regionName(b), language)),
  ];
  const storeRegionLabel = (option: string) => {
    if (option === STORE_REGION_AUTO) {
      return detectedRegion
        ? t("settings.storeRegion.automatic", { region: regionName(detectedRegion) })
        : t("settings.storeRegion.automaticNotDetected");
    }
    if (option === STORE_REGION_OFF) return t("settings.storeRegion.off");
    return regionName(option);
  };

  return (
    <Box sx={{ mb: 3 }}>
      <SettingsSubNav />
      <Typography variant="h4" component="h1" gutterBottom>
        {t("settings.title")}
      </Typography>
      <Card sx={{ maxWidth: 640 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            {t("settings.account.heading")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <Trans
              i18nKey="settings.account.signedInAs"
              values={{ username: currentUser?.username ?? "..." }}
              components={{ 1: <strong /> }}
            />
          </Typography>
          <Button
            variant="outlined"
            color="error"
            startIcon={<LogoutIcon />}
            sx={{ mt: 2 }}
            onClick={() => logoutMutation.mutate()}
          >
            {t("common.logOut")}
          </Button>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom>
            {t("settings.display.heading")}
          </Typography>
          <FormControlLabel
            control={<Switch checked={mode === "dark"} onChange={toggleColorMode} />}
            label={t("settings.display.darkMode")}
          />
          <FormControlLabel
            control={<Switch checked={contrast === "high"} onChange={toggleContrast} />}
            label={t("settings.display.highContrast")}
            sx={{ display: "block" }}
          />
          <AccentColorSetting />

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom>
            {t("settings.language.heading")}
          </Typography>
          <AutocompleteSelect<LanguageOption>
            label={t("settings.language.label")}
            options={SUPPORTED_LANGUAGES}
            value={SUPPORTED_LANGUAGES.find((option) => option.code === language) ?? null}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, val) => option.code === val.code}
            disableClearable
            onChange={(newValue) => setLanguage(newValue!.code)}
            sx={{ minWidth: 280 }}
          />

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom>
            {t("settings.currency.heading")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t("settings.currency.description")}
          </Typography>
          <AutocompleteSelect<CurrencyOption>
            label={t("settings.currency.label")}
            options={SUPPORTED_CURRENCIES}
            value={SUPPORTED_CURRENCIES.find((option) => option.code === currency) ?? null}
            getOptionLabel={(option) => `${option.name} (${getCurrencySymbol(option.code)})`}
            isOptionEqualToValue={(option, val) => option.code === val.code}
            disableClearable
            onChange={(newValue) => setCurrency(newValue!.code)}
            sx={{ minWidth: 280 }}
          />

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom>
            {t("settings.storeRegion.heading")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t("settings.storeRegion.description")}
          </Typography>
          <AutocompleteSelect<string>
            label={t("settings.storeRegion.label")}
            options={storeRegionOptions}
            value={storeRegion}
            getOptionLabel={storeRegionLabel}
            isOptionEqualToValue={(option, val) => option === val}
            disableClearable
            onChange={(newValue) => setStoreRegion(newValue!)}
            sx={{ minWidth: 280 }}
          />

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom>
            {t("settings.data.heading")}
          </Typography>
          <DataManagementSection />

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom>
            {t("settings.share.heading")}
          </Typography>
          <ShareSection />
        </CardContent>
      </Card>
    </Box>
  );
};

export default Settings;
