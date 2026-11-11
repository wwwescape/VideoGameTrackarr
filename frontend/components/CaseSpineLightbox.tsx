import { useMemo } from "react";
import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";
import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/counter.css";
import "yet-another-react-lightbox/styles.css";
import type { GameCase } from "../api/types";
import CaseSpine from "./CaseSpine";

// How much of the lightbox's height the spine fills (leaving room for the caption).
const FILL = 0.82;

interface CaseSpineLightboxProps {
  cases: GameCase[];
  // The case to open on; null while closed.
  index: number | null;
  onClose: () => void;
}

// Settings → Game Cases' previews, large: the same lightbox the game pages use for their
// images, with each platform's case drawn full height (a sample title down its title band, so
// its colours show) instead of a picture. Arrows, swipes and Escape work as they do there.
const CaseSpineLightbox = ({ cases, index, onClose }: CaseSpineLightboxProps) => {
  const { t } = useTranslation();
  const byKey = useMemo(() => new Map(cases.map((gameCase) => [`case-${gameCase.id}`, gameCase])), [cases]);
  const slides = useMemo(
    () =>
      cases.map((gameCase) => ({
        // Never loaded: render.slide below draws the case instead.
        src: `case-${gameCase.id}`,
        title: gameCase.platformName,
        description: t("settings.gameCases.caseSize", {
          label: gameCase.caseLabel,
          height: gameCase.heightMm,
          spine: gameCase.spineMm,
        }),
      })),
    [cases, t]
  );

  return (
    <Lightbox
      open={index !== null}
      index={index ?? 0}
      close={onClose}
      slides={slides}
      plugins={[Captions, Counter]}
      captions={{ descriptionTextAlign: "center" }}
      // Bottom left: the platform's name (the caption's title) has the top left.
      counter={{ container: { style: { top: "unset", bottom: 0 } } }}
      render={{
        slide: ({ slide, rect }) => {
          const gameCase = byKey.get(slide.src);
          if (!gameCase) return null;
          const height = Math.max(120, Math.round(rect.height * FILL));
          const width = Math.max(8, Math.round((height * gameCase.spineMm) / gameCase.heightMm));
          return (
            <Box
              role="img"
              aria-label={t("settings.gameCases.previewAlt", { platform: gameCase.platformName })}
              sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}
            >
              <CaseSpine
                width={width}
                height={height}
                look={gameCase}
                fallbackLabel={gameCase.abbreviation ?? gameCase.platformName}
                title={t("settings.gameCases.sampleTitle")}
              />
            </Box>
          );
        },
      }}
    />
  );
};

export default CaseSpineLightbox;
