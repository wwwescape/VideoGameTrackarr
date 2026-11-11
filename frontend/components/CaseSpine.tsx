import Box from "@mui/material/Box";
import type { GameCaseLook } from "../api/types";
import { contrastTextColor, gameCaseLogoUrl } from "../utils/caseSpine";

interface CaseSpineProps {
  width: number;
  height: number;
  look: GameCaseLook;
  // Shown in the logo band when the case has no logo file yet (the platform's short name).
  fallbackLabel: string;
  // The game's name, down the title band; omitted for a blank spine (previews).
  title?: string;
}

// The line under the logo band, in mm (scaled with the case; at least 1px).
const LOGO_LINE_MM = 1.5;

// One game case seen from its spine, as the curated case describes it: the case itself showing
// as a thin edge, a top (e.g. a PS3 case's clear top) and a foot, a logo band with the
// platform's spine logo and an optional line under it, and the title band with the game's
// name. Purely visual: the shelf wraps it in its own button.
const CaseSpine = ({ width, height, look, fallbackLabel, title }: CaseSpineProps) => {
  const pxPerMm = height / look.heightMm;
  const edge = Math.max(1, Math.round(width * 0.08));
  const top = Math.max(edge, Math.round(look.caseTopMm * pxPerMm));
  const foot = Math.max(2, Math.round(height * 0.025));
  const inner = height - top - foot;
  const bandHeight = Math.round((inner * look.logoBandHeightPct) / 100);
  const lineHeight = look.logoLineColor ? Math.max(1, Math.round(LOGO_LINE_MM * pxPerMm)) : 0;
  const logoSrc = gameCaseLogoUrl(look.logo);

  return (
    <Box
      aria-hidden
      data-testid="case-spine"
      sx={{
        // px strings: MUI reads a number of 1 or less as a percentage.
        width: `${width}px`,
        height: `${height}px`,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        pt: `${top}px`,
        px: `${edge}px`,
        pb: `${foot}px`,
        borderRadius: "2px 2px 0 0",
        backgroundColor: look.caseColor,
        boxShadow: "inset -2px 0 3px rgba(0,0,0,0.3), inset 1px 0 2px rgba(255,255,255,0.15)",
        overflow: "hidden",
      }}
    >
      <Box
        data-testid="logo-band"
        sx={{
          height: `${bandHeight}px`,
          flexShrink: 0,
          backgroundColor: look.logoBandColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {logoSrc ? (
          <Box
            component="img"
            src={logoSrc}
            alt=""
            draggable={false}
            sx={{
              maxWidth: "90%",
              maxHeight: "90%",
              objectFit: "contain",
              display: "block",
              // A one-colour logo: the image's own pixels are pushed out of its box and the box
              // is painted in the colour through the image's shape (its alpha).
              ...(look.logoColor && {
                objectPosition: "-99999px 0",
                backgroundColor: look.logoColor,
                maskImage: `url("${logoSrc}")`,
                maskSize: "100% 100%",
                maskRepeat: "no-repeat",
                WebkitMaskImage: `url("${logoSrc}")`,
                WebkitMaskSize: "100% 100%",
                WebkitMaskRepeat: "no-repeat",
              }),
            }}
          />
        ) : (
          <Box
            component="span"
            sx={{
              writingMode: "vertical-rl",
              fontSize: Math.max(6, Math.min(10, width * 0.5)),
              fontWeight: 800,
              lineHeight: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              maxHeight: "92%",
              color: contrastTextColor(look.logoBandColor),
            }}
          >
            {fallbackLabel}
          </Box>
        )}
      </Box>
      {lineHeight > 0 ? (
        <Box
          data-testid="logo-line"
          sx={{ height: `${lineHeight}px`, flexShrink: 0, backgroundColor: look.logoLineColor }}
        />
      ) : null}
      <Box
        data-testid="title-band"
        sx={{
          flex: 1,
          minHeight: 0,
          backgroundColor: look.titleBandColor,
          color: look.titleTextColor,
          display: "flex",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {title ? (
          <Box
            component="span"
            sx={{
              writingMode: "vertical-rl",
              py: 0.75,
              fontSize: Math.max(7, Math.min(11, width * 0.55)),
              fontWeight: 600,
              letterSpacing: 0.3,
              lineHeight: 1.15,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxHeight: "100%",
            }}
          >
            {title}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
};

export default CaseSpine;
