import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import type { GameCaseLook } from "../api/types";
import { steelbookRimPx } from "../utils/caseSpine";
import CaseSpine from "./CaseSpine";

interface SteelbookSpineProps {
  // The whole Steelbook, rims included (see steelbookSize).
  width: number;
  height: number;
  look: GameCaseLook;
  fallbackLabel: string;
  title?: string;
}

// The steel, lit from the left: a bright rim on the left, a shaded one on the right, so the
// case reads as a rounded tin. A little lighter in light mode.
const STEEL = {
  dark: "linear-gradient(90deg, #c3c8ce 0%, #8a9097 45%, #5c6168 100%)",
  light: "linear-gradient(90deg, #dde1e5 0%, #a9aeb5 45%, #7b8087 100%)",
};

// A Steelbook seen from its spine: the platform's spine art (the same CaseSpine the standard case
// draws: logo band, its line and the title band) printed on steel. The plastic case's own colour
// (its edges, top and foot) isn't drawn, so the steel shows there instead. Just as tall as the
// case and a thin rim wider on each side, with rounded corners. Purely visual, like CaseSpine:
// the shelf wraps it in its own button.
const SteelbookSpine = ({ width, height, look, fallbackLabel, title }: SteelbookSpineProps) => {
  const mode = useTheme().palette.mode;
  const rim = steelbookRimPx(height, look.heightMm);

  return (
    <Box
      aria-hidden
      data-testid="steelbook-spine"
      sx={{
        // px strings: MUI reads a number of 1 or less as a percentage.
        width: `${width}px`,
        height: `${height}px`,
        flexShrink: 0,
        display: "flex",
        boxSizing: "border-box",
        px: `${rim}px`,
        borderRadius: `${Math.max(1, rim)}px`,
        background: STEEL[mode],
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.3)",
        overflow: "hidden",
      }}
    >
      <CaseSpine
        width={Math.max(1, width - 2 * rim)}
        height={height}
        look={look}
        fallbackLabel={fallbackLabel}
        title={title}
        hideCase
      />
    </Box>
  );
};

export default SteelbookSpine;
