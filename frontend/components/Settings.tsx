import { useState } from "react";
import KeyIcon from "@mui/icons-material/KeyOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import Button from "@mui/material/Button";
import Switch from "@mui/material/Switch";
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
import ChangePasswordDialog from "./ChangePasswordDialog";
import DangerZoneSection from "./DangerZoneSection";
import DataManagementSection from "./DataManagementSection";
import GameFilterSettings from "./GameFilterSettings";
import SettingsFrame from "./SettingsFrame";
import { SettingRow, SettingsColumn, SettingsGroup } from "./SettingsLayout";
import ShareSection from "./ShareSection";

const Settings = () => {
  const { t } = useTranslation();
  const [passwordOpen, setPasswordOpen] = useState(false);
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
    <SettingsFrame>
      <SettingsColumn>
        <SettingsGroup title={t("settings.display.heading")}>
          <SettingRow name={t("settings.display.darkMode")} description={t("settings.display.darkModeHelp")}>
            <Switch
              checked={mode === "dark"}
              onChange={toggleColorMode}
              slotProps={{ input: { "aria-label": t("settings.display.darkMode") } }}
            />
          </SettingRow>
          <SettingRow name={t("settings.display.highContrast")} description={t("settings.display.highContrastHelp")}>
            <Switch
              checked={contrast === "high"}
              onChange={toggleContrast}
              slotProps={{ input: { "aria-label": t("settings.display.highContrast") } }}
            />
          </SettingRow>
          <SettingRow name={t("settings.display.accentColor")} description={t("settings.display.accentColorHelp")}>
            <AccentColorSetting inRow />
          </SettingRow>
        </SettingsGroup>

        <SettingsGroup title={t("settings.regional.heading")}>
          <SettingRow name={t("settings.language.label")}>
            <AutocompleteSelect<LanguageOption>
              label={t("settings.language.label")}
              options={SUPPORTED_LANGUAGES}
              value={SUPPORTED_LANGUAGES.find((option) => option.code === language) ?? null}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, val) => option.code === val.code}
              disableClearable
              onChange={(newValue) => setLanguage(newValue!.code)}
              sx={{ width: { xs: "100%", md: 300 } }}
            />
          </SettingRow>
          <SettingRow name={t("settings.currency.label")} description={t("settings.currency.description")}>
            <AutocompleteSelect<CurrencyOption>
              label={t("settings.currency.label")}
              options={SUPPORTED_CURRENCIES}
              value={SUPPORTED_CURRENCIES.find((option) => option.code === currency) ?? null}
              getOptionLabel={(option) => `${option.name} (${getCurrencySymbol(option.code)})`}
              isOptionEqualToValue={(option, val) => option.code === val.code}
              disableClearable
              onChange={(newValue) => setCurrency(newValue!.code)}
              sx={{ width: { xs: "100%", md: 300 } }}
            />
          </SettingRow>
          <SettingRow name={t("settings.storeRegion.heading")} description={t("settings.storeRegion.description")}>
            <AutocompleteSelect<string>
              label={t("settings.storeRegion.label")}
              options={storeRegionOptions}
              value={storeRegion}
              getOptionLabel={storeRegionLabel}
              isOptionEqualToValue={(option, val) => option === val}
              disableClearable
              onChange={(newValue) => setStoreRegion(newValue!)}
              sx={{ width: { xs: "100%", md: 300 } }}
            />
          </SettingRow>
        </SettingsGroup>

        <SettingsGroup title={t("settings.gameFilters.heading")}>
          <GameFilterSettings />
        </SettingsGroup>

        <SettingsGroup title={t("settings.data.heading")}>
          <SettingRow stacked>
            <DataManagementSection />
          </SettingRow>
        </SettingsGroup>

        <SettingsGroup title={t("settings.share.heading")}>
          <SettingRow stacked>
            <ShareSection />
          </SettingRow>
        </SettingsGroup>

        <SettingsGroup title={t("settings.account.heading")}>
          <SettingRow
            name={
              <Trans
                i18nKey="settings.account.signedInAs"
                values={{ username: currentUser?.username ?? "..." }}
                components={{ 1: <strong /> }}
              />
            }
          >
            <Button variant="outlined" color="error" startIcon={<LogoutIcon />} onClick={() => logoutMutation.mutate()}>
              {t("common.logOut")}
            </Button>
          </SettingRow>
          <SettingRow name={t("settings.account.password")} description={t("settings.account.passwordHelp")}>
            <Button variant="outlined" startIcon={<KeyIcon />} onClick={() => setPasswordOpen(true)}>
              {t("settings.account.changePassword")}
            </Button>
          </SettingRow>
        </SettingsGroup>
        <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />

        <DangerZoneSection />
      </SettingsColumn>
    </SettingsFrame>
  );
};

export default Settings;
