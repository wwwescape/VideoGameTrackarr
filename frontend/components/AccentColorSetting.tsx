import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useColorMode } from "../theme/ColorModeProvider";
import { DEFAULT_ACCENT_HEX } from "../theme/colors";

// The default purple first. Every preset is a seed for the whole M3 scheme (SchemeVibrant),
// which picks contrast-safe tones from it in light, dark and high-contrast mode, so the
// buttons themselves won't be exactly these hex values. Brown and blue grey were tried and
// left out: the vibrant scheme turns them rust-orange and petrol blue, duplicating Orange
// and Teal.
export const ACCENT_PRESETS: { hex: string; nameKey: string }[] = [
  { hex: DEFAULT_ACCENT_HEX.toLowerCase(), nameKey: "settings.display.accentColors.purple" },
  { hex: "#3949ab", nameKey: "settings.display.accentColors.indigo" },
  { hex: "#039be5", nameKey: "settings.display.accentColors.lightBlue" },
  { hex: "#00897b", nameKey: "settings.display.accentColors.teal" },
  { hex: "#43a047", nameKey: "settings.display.accentColors.green" },
  { hex: "#fbc02d", nameKey: "settings.display.accentColors.yellow" },
  { hex: "#fb8c00", nameKey: "settings.display.accentColors.orange" },
  { hex: "#e53935", nameKey: "settings.display.accentColors.red" },
  { hex: "#d81b60", nameKey: "settings.display.accentColors.pink" },
  { hex: "#8e24aa", nameKey: "settings.display.accentColors.violet" },
];

const SWATCH_SIZE = 36;

const swatchSx = {
  width: SWATCH_SIZE,
  height: SWATCH_SIZE,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  "&.Mui-focusVisible, &:focus-within": { outline: "2px solid", outlineColor: "text.primary", outlineOffset: 2 },
} as const;

// Settings → Display → Accent color (idea and first version by @minifluff, PR #32). Saved
// per browser by ColorModeProvider, like dark mode and contrast.
const AccentColorSetting = () => {
  const { t } = useTranslation();
  const { accentColor, setAccentColor, resetAccentColor } = useColorMode();
  const isPreset = ACCENT_PRESETS.some((preset) => preset.hex === accentColor);

  // The native color picker fires on every drag step; rebuilding the whole theme that often
  // stutters, so the picked color is applied once it settles.
  const [customDraft, setCustomDraft] = useState<string | null>(null);
  const debouncedDraft = useDebouncedValue(customDraft, 150);
  useEffect(() => {
    if (debouncedDraft) setAccentColor(debouncedDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDraft]);

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="body1" id="accent-color-label">
        {t("settings.display.accentColor")}
      </Typography>
      <Box
        role="group"
        aria-labelledby="accent-color-label"
        sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1, mb: 0.5 }}
      >
        {ACCENT_PRESETS.map((preset) => {
          const selected = preset.hex === accentColor;
          return (
            <Tooltip key={preset.hex} title={t(preset.nameKey)}>
              <ButtonBase
                aria-label={t(preset.nameKey)}
                aria-pressed={selected}
                onClick={() => {
                  setCustomDraft(null);
                  setAccentColor(preset.hex);
                }}
                sx={{ ...swatchSx, bgcolor: preset.hex, color: "#fff" }}
              >
                {selected ? <CheckIcon fontSize="small" sx={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,0.6))" }} /> : null}
              </ButtonBase>
            </Tooltip>
          );
        })}
        <Tooltip title={t("settings.display.customAccentColor")}>
          <Box
            component="label"
            sx={{
              ...swatchSx,
              position: "relative",
              cursor: "pointer",
              border: "2px dashed",
              borderColor: "text.secondary",
              color: isPreset ? "text.secondary" : "#fff",
              bgcolor: isPreset ? "transparent" : accentColor,
            }}
          >
            {isPreset ? <AddIcon fontSize="small" /> : <CheckIcon fontSize="small" />}
            <Box
              component="input"
              type="color"
              value={customDraft ?? accentColor}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setCustomDraft(event.target.value)}
              aria-label={t("settings.display.customAccentColor")}
              sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
            />
          </Box>
        </Tooltip>
      </Box>
      <Typography variant="caption" color="text.secondary" component="div">
        {t("settings.display.accentColorHelp")}
      </Typography>
      {accentColor !== DEFAULT_ACCENT_HEX.toLowerCase() ? (
        <Button
          size="small"
          onClick={() => {
            setCustomDraft(null);
            resetAccentColor();
          }}
          sx={{ mt: 0.5, px: 0 }}
        >
          {t("settings.display.resetAccentColor")}
        </Button>
      ) : null}
    </Box>
  );
};

export default AccentColorSetting;
