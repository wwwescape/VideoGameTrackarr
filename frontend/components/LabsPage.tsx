import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Switch from "@mui/material/Switch";
import { useTranslation } from "react-i18next";
import type { LabId } from "../api/labs";
import { useLabs, useSetLabEnabled } from "../hooks/useLabs";
import SettingsFrame from "./SettingsFrame";
import { SettingRow, SettingsColumn, SettingsGroup } from "./SettingsLayout";

// Settings → Labs: VGT's feature flags. Each lab is an experimental feature, off until you
// turn it on here, for the whole app and its share page.
const LabsPage = () => {
  const { t } = useTranslation();
  const { data: labs, isLoading, isError } = useLabs();
  const setLab = useSetLabEnabled();

  const toggle = (id: LabId, enabled: boolean) => setLab.mutate({ id, enabled });

  return (
    <SettingsFrame description={t("settings.labs.description")}>
      <SettingsColumn>
        {isLoading ? (
          <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
        ) : isError ? (
          <Alert severity="error">{t("settings.labs.loadFailed")}</Alert>
        ) : (
          <SettingsGroup title={t("settings.labs.heading")}>
            {(labs ?? []).map((lab) => (
              <SettingRow
                key={lab.id}
                name={t(`settings.labs.items.${lab.id}.name`)}
                description={t(`settings.labs.items.${lab.id}.description`)}
              >
                <Switch
                  checked={lab.enabled}
                  disabled={setLab.isPending}
                  onChange={(event) => toggle(lab.id, event.target.checked)}
                  slotProps={{ input: { "aria-label": t(`settings.labs.items.${lab.id}.name`) } }}
                />
              </SettingRow>
            ))}
          </SettingsGroup>
        )}
        {setLab.isError ? <Alert severity="error">{t("settings.labs.saveFailed")}</Alert> : null}
      </SettingsColumn>
    </SettingsFrame>
  );
};

export default LabsPage;
