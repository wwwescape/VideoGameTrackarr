import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import type { GameCase } from "../api/types";
import { useGameCases, useSetGameCaseShown } from "../hooks/useGameCases";
import { caseSizeToPixels, platformLogoSrc } from "../utils/caseSpine";
import CaseSpine from "./CaseSpine";
import CaseSpineLightbox from "./CaseSpineLightbox";
import { withLab } from "./LabGate";
import SettingsFrame from "./SettingsFrame";
import { SettingRow, SettingsColumn, SettingsGroup } from "./SettingsLayout";

// The previews are drawn small, at a fixed fraction of real size, but in true proportion.
const PREVIEW_SCALE = 0.15;

const CaseRow = ({
  gameCase,
  onToggle,
  onOpen,
}: {
  gameCase: GameCase;
  onToggle: (shown: boolean) => void;
  // Shows the preview large, in the lightbox.
  onOpen: () => void;
}) => {
  const { t } = useTranslation();
  const mode = useTheme().palette.mode;
  const logo = platformLogoSrc({ slug: gameCase.platformSlug, logoUrl: gameCase.logoUrl }, mode);
  const size = caseSizeToPixels(gameCase.heightMm, gameCase.spineMm, PREVIEW_SCALE);
  return (
    <SettingRow
      name={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 48, height: 24, display: "flex", alignItems: "center", flexShrink: 0 }}>
            {logo ? (
              <Box
                component="img"
                loading="lazy"
                src={logo}
                alt=""
                sx={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            ) : null}
          </Box>
          {gameCase.platformName}
        </Box>
      }
      description={t("settings.gameCases.caseSummary", {
        label: gameCase.caseLabel,
        height: gameCase.heightMm,
        spine: gameCase.spineMm,
        count: gameCase.physicalGames,
      })}
    >
      <Box sx={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
        <ButtonBase
          onClick={onOpen}
          aria-label={t("settings.gameCases.openPreview", { platform: gameCase.platformName })}
          sx={{
            opacity: gameCase.shown ? 1 : 0.35,
            display: "flex",
            alignItems: "flex-end",
            borderRadius: 0.5,
            cursor: "zoom-in",
            transition: "transform 150ms ease",
            "&:hover": { transform: "scale(1.06)" },
            "&.Mui-focusVisible": { outline: 2, outlineColor: "primary.main", outlineOffset: 3 },
          }}
        >
          <CaseSpine
            {...size}
            look={gameCase}
            fallbackLabel={gameCase.abbreviation ?? gameCase.platformName}
          />
        </ButtonBase>
        <Switch
          checked={gameCase.shown}
          onChange={(event) => onToggle(event.target.checked)}
          slotProps={{
            input: {
              "aria-label": t("settings.gameCases.showOnShelf", {
                platform: gameCase.platformName,
              }),
            },
          }}
        />
      </Box>
    </SettingRow>
  );
};

// Settings → Game Cases (Game Shelf lab): the platforms that have a standard game case, each with
// a preview and a Show on shelf switch. The cases themselves are curated
// (docs/data/game_cases/Game_Cases.csv); cartridge-only systems have none.
const GameCasesPage = () => {
  const { t } = useTranslation();
  const { data: cases, isLoading, isError } = useGameCases();
  const setShown = useSetGameCaseShown();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <SettingsFrame description={t("settings.gameCases.description")}>
      <SettingsColumn>
        {isLoading ? (
          <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
        ) : isError ? (
          <Alert severity="error">{t("settings.gameCases.loadFailed")}</Alert>
        ) : (
          <SettingsGroup
            title={t("settings.gameCases.heading")}
            lead={t("settings.gameCases.lead", { count: cases?.length ?? 0 })}
          >
            {(cases ?? []).map((gameCase, index) => (
              <CaseRow
                key={gameCase.id}
                gameCase={gameCase}
                onToggle={(shown) => setShown.mutate({ id: gameCase.id, shown })}
                onOpen={() => setOpenIndex(index)}
              />
            ))}
          </SettingsGroup>
        )}
        {setShown.isError ? (
          <Typography color="error" variant="body2">
            {t("settings.gameCases.saveFailed")}
          </Typography>
        ) : null}
        <CaseSpineLightbox cases={cases ?? []} index={openIndex} onClose={() => setOpenIndex(null)} />
      </SettingsColumn>
    </SettingsFrame>
  );
};

export default withLab("game_shelf", GameCasesPage);
