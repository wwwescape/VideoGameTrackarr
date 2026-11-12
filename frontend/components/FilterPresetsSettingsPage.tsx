import { useTranslation } from "react-i18next";
import GameFilterSettings from "./GameFilterSettings";
import { withLab } from "./LabGate";
import SettingsFrame from "./SettingsFrame";
import { SettingsColumn, SettingsGroup } from "./SettingsLayout";

// Settings → Filter Presets (Filter Presets lab): which fields the game lists' Filter dialog
// shows, and the presets saved from the ▾ on their Filter button. Both are kept on the account,
// so every browser has them.
const FilterPresetsSettingsPage = () => {
  const { t } = useTranslation();

  return (
    <SettingsFrame description={t("settings.filterPresets.description")}>
      <SettingsColumn>
        <SettingsGroup title={t("settings.gameFilters.heading")}>
          <GameFilterSettings />
        </SettingsGroup>
      </SettingsColumn>
    </SettingsFrame>
  );
};

export default withLab("filter_presets", FilterPresetsSettingsPage);
