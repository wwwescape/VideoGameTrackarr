import Box from "@mui/material/Box";
import Menu from "@mui/material/Menu";
import Slider from "@mui/material/Slider";
import { useTranslation } from "react-i18next";
import { useLocalPreference } from "../hooks/useLocalPreference";
import { DEFAULT_SHELF_SCALE, MAX_SHELF_SCALE, MIN_SHELF_SCALE } from "../utils/caseSpine";

// The Game Shelf's one option, its scale, shared by the private shelf and the share page's and
// kept in this browser.

// Phones start smaller, so a row holds more than a handful of cases.
const PHONE_SHELF_SCALE = 0.3;

const initialScale = () => {
  try {
    return window.matchMedia("(max-width: 599.95px)").matches
      ? PHONE_SHELF_SCALE
      : DEFAULT_SHELF_SCALE;
  } catch {
    return DEFAULT_SHELF_SCALE;
  }
};

export function useShelfScale() {
  return useLocalPreference("shelf.scale", initialScale());
}

export const ShelfScaleSlider = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ px: 2, pt: 1, pb: 1.5, width: 260 }}>
      <Box id="shelf-scale-label" sx={{ typography: "overline", color: "vgt.text3" }}>
        {t("games.shelf.scale")}
      </Box>
      <Slider
        value={value}
        min={MIN_SHELF_SCALE}
        max={MAX_SHELF_SCALE}
        step={0.05}
        onChange={(_event, next) => onChange(Math.round((next as number) * 100) / 100)}
        aria-labelledby="shelf-scale-label"
        valueLabelDisplay="auto"
        valueLabelFormat={(scale) => `${Math.round(scale * 100)}%`}
      />
    </Box>
  );
};

// The share page's Options menu; the private shelf puts the slider in the shared list
// controls' Options menu instead.
export const ShelfOptionsMenu = ({
  anchor,
  onClose,
  scale,
  onScaleChange,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  scale: number;
  onScaleChange: (value: number) => void;
}) => (
  <Menu anchorEl={anchor} open={anchor !== null} onClose={onClose}>
    <ShelfScaleSlider value={scale} onChange={onScaleChange} />
  </Menu>
);
