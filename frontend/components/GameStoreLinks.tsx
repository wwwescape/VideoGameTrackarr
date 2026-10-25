import { useTranslation } from "react-i18next";
import type { GameAboutData } from "../api/types";
import { useStoreRegion } from "../theme/StoreRegionProvider";
import { localiseStoreUrl } from "../utils/storeRegion";

export interface StoreLink {
  key: string;
  // The site's own name, not translated.
  label: string;
  // "View on Steam", for the link's tooltip.
  title: string;
  href: string;
}

type StoreLinkGame = Pick<
  GameAboutData,
  "igdbUrl" | "steamStoreUrl" | "xboxStoreUrl" | "playstationStoreUrl" | "nintendoStoreUrl" | "epicGamesStoreUrl" | "gogStoreUrl"
>;

// The IGDB and store-page links (Steam, Xbox, PlayStation in your store region, Nintendo, Epic,
// GOG) the game has, in that order — the hero shows them as chips, on the in-app game page and
// the public share page.
export function useGameStoreLinks(game: StoreLinkGame): StoreLink[] {
  const { t, i18n } = useTranslation();
  const { region: storeRegion } = useStoreRegion();
  // From i18next rather than LanguageProvider, so this doesn't pull in i18n setup.
  const language = i18n.resolvedLanguage ?? i18n.language;
  const links: (StoreLink | null)[] = [
    game.igdbUrl ? { key: "igdb", label: "IGDB", title: t("games.about.viewOnIgdb"), href: game.igdbUrl } : null,
    game.steamStoreUrl ? { key: "steam", label: "Steam", title: t("games.about.viewOnSteam"), href: game.steamStoreUrl } : null,
    game.xboxStoreUrl
      ? {
          key: "xbox",
          label: "Xbox",
          title: t("games.about.viewOnXbox"),
          href: localiseStoreUrl(game.xboxStoreUrl, "xbox", storeRegion, language),
        }
      : null,
    game.playstationStoreUrl
      ? {
          key: "playstation",
          label: "PlayStation",
          title: t("games.about.viewOnPlaystation"),
          href: localiseStoreUrl(game.playstationStoreUrl, "playstation", storeRegion, language),
        }
      : null,
    game.nintendoStoreUrl
      ? { key: "nintendo", label: "Nintendo", title: t("games.about.viewOnNintendo"), href: game.nintendoStoreUrl }
      : null,
    game.epicGamesStoreUrl
      ? { key: "epic", label: "Epic Games", title: t("games.about.viewOnEpicGames"), href: game.epicGamesStoreUrl }
      : null,
    game.gogStoreUrl ? { key: "gog", label: "GOG", title: t("games.about.viewOnGog"), href: game.gogStoreUrl } : null,
  ];
  return links.filter((link): link is StoreLink => link !== null);
}
