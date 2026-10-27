import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { LibraryPlatform } from "../api/types";
import { useLibraryPlatforms } from "../hooks/usePlatforms";
import { platformIdentifier } from "../utils/platformLogos";
import { platformDisplayName, platformScopeQuery, type PlatformScope } from "../utils/platformScope";
import CatalogIndexGrid, { type CatalogIndexColumn } from "./CatalogIndexGrid";
import PlatformCard, { PlatformLogo } from "./PlatformCard";

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

  const tableColumns: CatalogIndexColumn<PlatformCardEntry>[] = [
    { key: "owned", label: t("games.platformsPage.columnOwned"), render: (entry) => entry.ownedCount, sortValue: (entry) => entry.ownedCount },
    {
      key: "wishlisted",
      label: t("games.platformsPage.columnWishlisted"),
      render: (entry) => entry.wishlistedCount,
      sortValue: (entry) => entry.wishlistedCount,
    },
    {
      key: "logo",
      label: "",
      hideOnPhone: true,
      render: (entry) => <PlatformLogo platform={entry} scope={entry.scope} height={22} />,
    },
  ];

  return (
    <CatalogIndexGrid
      stateKey="platforms"
      emptyMessage={t("games.platformsPage.emptyMessage")}
      countKey="games.platformsPage.count"
      searchLabel={t("games.platformsPage.searchLabel")}
      searchPlaceholder={t("games.platformsPage.searchPlaceholder")}
      entries={entries}
      isLoading={isLoading}
      getKey={(entry) => entry.key}
      getCount={totalGames}
      getHref={(entry) => `/games/platforms/${platformIdentifier(entry)}${platformScopeQuery(entry.scope)}`}
      renderCard={(entry, onClick) => <PlatformCard platform={entry} scope={entry.scope} onClick={onClick} />}
      tableColumns={tableColumns}
      statusFilter={{
        label: t("catalog.index.filterOwnership"),
        choices: [
          { value: "owned", label: t("catalog.index.filterWithOwned"), matches: (entry) => entry.ownedCount > 0 },
          { value: "wishlisted", label: t("catalog.index.filterWithWishlisted"), matches: (entry) => entry.wishlistedCount > 0 },
        ],
      }}
    />
  );
};

export default PlatformsPage;
