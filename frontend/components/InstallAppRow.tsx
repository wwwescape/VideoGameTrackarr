import InstallIcon from "@mui/icons-material/InstallDesktopOutlined";
import Button from "@mui/material/Button";
import { useTranslation } from "react-i18next";
import { promptInstall, useInstallState } from "../hooks/useInstallApp";
import { SettingRow } from "./SettingsLayout";

// Settings → App: an Install button where the browser offers one, otherwise how to install VGT
// in this browser (or why it can't be).
const InstallAppRow = () => {
  const { t } = useTranslation();
  const state = useInstallState();
  return (
    <SettingRow name={t("settings.installApp.name")} description={t(`settings.installApp.${state}`)}>
      {state === "prompt" ? (
        <Button variant="outlined" startIcon={<InstallIcon />} onClick={() => void promptInstall()}>
          {t("settings.installApp.install")}
        </Button>
      ) : null}
    </SettingRow>
  );
};

export default InstallAppRow;
