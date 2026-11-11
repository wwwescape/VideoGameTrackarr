import HideImageIcon from "@mui/icons-material/HideImageOutlined";
import SlideshowIcon from "@mui/icons-material/SlideshowOutlined";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useSetScreensaverExcluded } from "../hooks/useScreensaver";
import { TOAST_OPTIONS } from "../utils/toastOptions";

interface ScreensaverToggleProps {
  gameId: number;
  excluded: boolean;
}

// A game page's Screensaver toggle (Screensaver lab), in the hero's corner: whether this game's
// cover comes up in the screensaver. Flips at once and flips back if saving fails.
const ScreensaverToggle = ({ gameId, excluded }: ScreensaverToggleProps) => {
  const { t } = useTranslation();
  const setExcluded = useSetScreensaverExcluded(gameId);
  const label = excluded ? t("screensaver.toggle.showLabel") : t("screensaver.toggle.hideLabel");

  const toggle = () => {
    const next = !excluded;
    setExcluded.mutate(next, {
      onSuccess: () =>
        toast.success(next ? t("screensaver.toggle.hidden") : t("screensaver.toggle.shown"), TOAST_OPTIONS),
      onError: () => toast.error(t("screensaver.toggle.saveFailed"), TOAST_OPTIONS),
    });
  };

  return (
    <Tooltip title={excluded ? t("screensaver.toggle.hiddenTooltip") : t("screensaver.toggle.shownTooltip")}>
      <IconButton
        onClick={toggle}
        aria-label={label}
        aria-pressed={excluded}
        size="small"
        sx={{
          border: 1,
          borderColor: "divider",
          bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(0, 0, 0, 0.45)" : "rgba(255, 255, 255, 0.75)"),
          backdropFilter: "blur(6px)",
          color: excluded ? "text.secondary" : "primary.main",
          "&:hover": {
            bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(0, 0, 0, 0.65)" : "rgba(255, 255, 255, 0.95)"),
          },
        }}
      >
        {excluded ? <HideImageIcon fontSize="small" /> : <SlideshowIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
};

export default ScreensaverToggle;
