import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { LibraryPlatform } from "../api/types";
import { useLibraryPlatforms } from "../hooks/usePlatforms";
import { platformIdentifier } from "../utils/platformLogos";
import { platformDisplayName, platformScopeQuery, type PlatformScope } from "../utils/platformScope";
import CatalogIndexGrid from "./CatalogIndexGrid";
import GamesSubNav from "./GamesSubNav";
import PlatformCard from "./PlatformCard";

// Taller than a CatalogRefCard: each card has a logo area above the name and counts.
const PLATFORM_CARD_HEIGHT_BY_COLUMNS: Record<number, number> = {
  2: 170,
  3: 166,
  4: 162,
  6: 158,
};

// One card. PC comes back as several (one per storefront/format), so the card's own name
// ("PC · Steam") is what search and sort use.
export interface PlatformCardEntry extends LibraryPlatform {
  scope: PlatformScope;
  key: string;
}

const totalGames = (entry: PlatformCardEntry) => entry.ownedCount + entry.wishlistedCount;

const PlatformsPage = () => {
  const { t } = useTranslation();
  const { data: platforms, isLoading } = useLibraryPlatforms();

  const entries = useMemo(
    () =>
      platforms?.map((platform): PlatformCardEntry => {
        const scope: PlatformScope = platform.format
          ? { format: platform.format, storefront: platform.storefront ?? undefined }
          : {};
        return {
          ...platform,
          scope,
          key: `${platform.id}:${platform.format ?? ""}:${platform.storefront ?? ""}`,
          name: platformDisplayName(platform, scope, t),
        };
      }),
    [platforms, t]
  );

  return (
    <>
      <GamesSubNav />
      <CatalogIndexGrid
        stateKey="platforms"
        title={t("games.platformsPage.title")}
        description={t("games.platformsPage.description")}
        emptyMessage={t("games.platformsPage.emptyMessage")}
        searchLabel={t("games.platformsPage.searchLabel")}
        searchPlaceholder={t("games.platformsPage.searchPlaceholder")}
        entries={entries}
        isLoading={isLoading}
        getKey={(entry) => entry.key}
        getCount={totalGames}
        showMinGamesFilter
        minGamesDefault={1}
        getHref={(entry) => `/games/platforms/${platformIdentifier(entry)}${platformScopeQuery(entry.scope)}`}
        renderCard={(entry, onClick) => <PlatformCard platform={entry} scope={entry.scope} onClick={onClick} />}
        estimateRowHeight={(columns) => PLATFORM_CARD_HEIGHT_BY_COLUMNS[columns] ?? 164}
      />
    </>
  );
};

export default PlatformsPage;
