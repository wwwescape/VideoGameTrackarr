import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import {
  SCREENSAVER_MAX_INTERVAL,
  SCREENSAVER_MIN_INTERVAL,
  useScreensaverInterval,
} from "../hooks/useScreensaver";
import { withLab } from "./LabGate";
import SettingsFrame from "./SettingsFrame";
import { SettingRow, SettingsColumn, SettingsGroup } from "./SettingsLayout";

const MARKS = [5, 10, 15].map((value) => ({ value, label: `${value}` }));

// Settings → Screensaver (Screensaver lab): how long each cover stays on screen, kept on the
// account so every screen running it uses the same.
const ScreensaverSettingsPage = () => {
  const { t } = useTranslation();
  const { seconds, save } = useScreensaverInterval();
  // The slider moves freely while dragged and saves once, on release.
  const [draft, setDraft] = useState(seconds);
  useEffect(() => setDraft(seconds), [seconds]);

  return (
    <SettingsFrame description={t("settings.screensaver.description")}>
      <SettingsColumn>
        <SettingsGroup title={t("settings.screensaver.heading")} lead={t("settings.screensaver.included")}>
          <SettingRow
            name={t("settings.screensaver.interval")}
            description={t("settings.screensaver.intervalDescription")}
            stacked
          >
            <Box sx={{ px: 1, maxWidth: 420 }}>
              <Slider
                value={draft}
                min={SCREENSAVER_MIN_INTERVAL}
                max={SCREENSAVER_MAX_INTERVAL}
                step={1}
                marks={MARKS}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => t("settings.screensaver.seconds", { count: value })}
                getAriaValueText={(value) => t("settings.screensaver.seconds", { count: value })}
                aria-label={t("settings.screensaver.interval")}
                onChange={(_event, value) => setDraft(value as number)}
                onChangeCommitted={(_event, value) => {
                  if (value !== seconds) save.mutate(value as number);
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {t("settings.screensaver.current", { count: draft })}
              </Typography>
            </Box>
          </SettingRow>
        </SettingsGroup>
        {save.isError ? (
          <Typography color="error" variant="body2" role="alert" sx={{ mt: 1 }}>
            {t("settings.screensaver.saveFailed")}
          </Typography>
        ) : null}
      </SettingsColumn>
    </SettingsFrame>
  );
};

export default withLab("screensaver", ScreensaverSettingsPage);
