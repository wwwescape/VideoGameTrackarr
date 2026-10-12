import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { DEFAULT_APP_TITLE, useAppearance } from "../theme/AppearanceProvider";
import { SEED_COLOR_HEX } from "../theme/m3Colors";

const PRESET_COLORS = [
  "#7C4DFF", // default vivid purple
  "#D81B60", // pink
  "#E53935", // red
  "#FB8C00", // orange
  "#FBC02D", // yellow
  "#43A047", // green
  "#00897B", // teal
  "#039BE5", // light blue
  "#3949AB", // indigo
  "#8E24AA", // purple
  "#6D4C41", // brown
  "#546E7A", // blue grey
];

const AppearanceSection = () => {
  const { t } = useTranslation();
  const { accentColor, setAccentColor, appTitle, setAppTitle, resetAppearance } = useAppearance();
  const [titleDraft, setTitleDraft] = useState(appTitle);

  const handleTitleBlur = () => {
    if (titleDraft !== appTitle) {
      setAppTitle(titleDraft);
      setTitleDraft(titleDraft.trim() ? titleDraft.trim() : DEFAULT_APP_TITLE);
    }
  };

  const handleTitleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      (event.target as HTMLInputElement).blur();
    }
  };

  const isCustomized = accentColor !== SEED_COLOR_HEX || appTitle !== DEFAULT_APP_TITLE;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t("settings.appearance.description")}
      </Typography>

      <Typography variant="subtitle2" gutterBottom>
        {t("settings.appearance.accentColor")}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}>
        {PRESET_COLORS.map((hex) => (
          <Box
            key={hex}
            role="button"
            tabIndex={0}
            aria-label={hex}
            onClick={() => setAccentColor(hex)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setAccentColor(hex);
            }}
            sx={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              backgroundColor: hex,
              cursor: "pointer",
              border: (theme) =>
                accentColor.toLowerCase() === hex.toLowerCase()
                  ? `3px solid ${theme.palette.primary.contrastText}`
                  : "3px solid transparent",
              outline: (theme) =>
                accentColor.toLowerCase() === hex.toLowerCase()
                  ? `2px solid ${theme.palette.text.primary}`
                  : "none",
              outlineOffset: 2,
            }}
          />
        ))}
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: (theme) => `2px dashed ${theme.palette.text.secondary}`,
            fontSize: 20,
            color: "text.secondary",
            position: "relative",
            overflow: "hidden",
          }}
          title={t("settings.appearance.customColor")}
        >
          +
          <input
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            aria-label={t("settings.appearance.customColor")}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: 0,
              cursor: "pointer",
            }}
          />
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
        {t("settings.appearance.accentColorHelp")}
      </Typography>

      <Typography variant="subtitle2" gutterBottom>
        {t("settings.appearance.appTitle")}
      </Typography>
      <TextField
        value={titleDraft}
        onChange={(e) => setTitleDraft(e.target.value)}
        onBlur={handleTitleBlur}
        onKeyDown={handleTitleKeyDown}
        placeholder={DEFAULT_APP_TITLE}
        fullWidth
        sx={{ maxWidth: 400, mb: 2 }}
        helperText={t("settings.appearance.appTitleHelp")}
      />

      {isCustomized && (
        <Box>
          <Button variant="outlined" onClick={resetAppearance}>
            {t("settings.appearance.reset")}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default AppearanceSection;
