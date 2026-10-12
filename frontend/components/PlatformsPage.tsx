import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { usePlatforms } from "../hooks/usePlatforms";
import CatalogIndexGrid from "./CatalogIndexGrid";
import GamesSubNav from "./GamesSubNav";

const PlatformsPage = () => {
  const { t } = useTranslation();
  const { data: platforms, isLoading } = usePlatforms();

  // The index only lists platforms that actually have games — same as the Collections and
  // Series indexes, which exclude empty entries rather than linking to an empty page.
  const entries = useMemo(
    () =>
      (platforms ?? [])
        .filter((platform) => platform.gameCount > 0 && platform.slug)
        .map((platform) => ({
          id: platform.id,
          name: platform.name,
          slug: platform.slug,
          gameCount: platform.gameCount,
        })),
    [platforms]
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
        getHref={(entry) => `/games/platforms/${entry.slug ?? ""}`}
      />
    </>
  );
};

export default PlatformsPage;
