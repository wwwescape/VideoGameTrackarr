import { useTheme } from "@mui/material/styles";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";
import epicGamesLogo from "../assets/epic-games-logo.png";
import gogLogo from "../assets/gog.com-logo.png";
import igdbLogo from "../assets/igdb-logo.png";
import nintendoLogo from "../assets/nintendo-logo.png";
import playstationLogo from "../assets/playstation-logo.png";
import steamLogo from "../assets/steam-logo.png";
import xboxLogo from "../assets/xbox-logo.png";
import type { GameAboutData } from "../api/types";
import { useStoreRegion } from "../theme/StoreRegionProvider";
import { localiseStoreUrl } from "../utils/storeRegion";

// The IGDB and store-page logo links (Steam, Xbox, PlayStation in your store region, Nintendo,
// Epic, GOG) — shared by the in-app game page and the public share page.
export const GameStoreLinks = ({
  game,
}: {
  game: Pick<GameAboutData, "igdbUrl" | "steamStoreUrl" | "xboxStoreUrl" | "playstationStoreUrl" | "nintendoStoreUrl" | "epicGamesStoreUrl" | "gogStoreUrl">;
}) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { region: storeRegion } = useStoreRegion();
  // From i18next rather than LanguageProvider, so this section doesn't pull in i18n setup.
  const language = i18n.resolvedLanguage ?? i18n.language;
  return (
  <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
    {game.igdbUrl && (
      <Tooltip title={t("games.about.viewOnIgdb")}>
        <a
          href={game.igdbUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: theme.palette.text.primary }}
        >
          <img src={igdbLogo} alt={t("games.about.viewOnIgdb")} style={{ width: "64px" }} />
        </a>
      </Tooltip>
    )}
    {game.steamStoreUrl && (
      <Tooltip title={t("games.about.viewOnSteam")}>
        <a
          href={game.steamStoreUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: theme.palette.text.primary }}
        >
          <img src={steamLogo} alt={t("games.about.viewOnSteam")} style={{ width: "64px" }} />
        </a>
      </Tooltip>
    )}
    {game.xboxStoreUrl && (
      <Tooltip title={t("games.about.viewOnXbox")}>
        <a
          href={localiseStoreUrl(game.xboxStoreUrl, "xbox", storeRegion, language)}
          target="_blank"
          rel="noreferrer"
          style={{ color: theme.palette.text.primary }}
        >
          <img src={xboxLogo} alt={t("games.about.viewOnXbox")} style={{ width: "64px" }} />
        </a>
      </Tooltip>
    )}
    {game.playstationStoreUrl && (
      <Tooltip title={t("games.about.viewOnPlaystation")}>
        <a
          href={localiseStoreUrl(game.playstationStoreUrl, "playstation", storeRegion, language)}
          target="_blank"
          rel="noreferrer"
          style={{ color: theme.palette.text.primary }}
        >
          <img
            src={playstationLogo}
            alt={t("games.about.viewOnPlaystation")}
            style={{ width: "64px" }}
          />
        </a>
      </Tooltip>
    )}
    {game.nintendoStoreUrl && (
      <Tooltip title={t("games.about.viewOnNintendo")}>
        <a
          href={game.nintendoStoreUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: theme.palette.text.primary }}
        >
          <img src={nintendoLogo} alt={t("games.about.viewOnNintendo")} style={{ width: "64px" }} />
        </a>
      </Tooltip>
    )}
    {game.epicGamesStoreUrl && (
      <Tooltip title={t("games.about.viewOnEpicGames")}>
        <a
          href={game.epicGamesStoreUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: theme.palette.text.primary }}
        >
          <img src={epicGamesLogo} alt={t("games.about.viewOnEpicGames")} style={{ width: "64px" }} />
        </a>
      </Tooltip>
    )}
    {game.gogStoreUrl && (
      <Tooltip title={t("games.about.viewOnGog")}>
        <a
          href={game.gogStoreUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: theme.palette.text.primary }}
        >
          <img src={gogLogo} alt={t("games.about.viewOnGog")} style={{ width: "64px" }} />
        </a>
      </Tooltip>
    )}
  </Stack>
  );
};
