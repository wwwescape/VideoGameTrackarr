import { useTranslation } from "react-i18next";
import { useCollections } from "../hooks/useCatalogBrowse";
import CatalogIndexGrid from "./CatalogIndexGrid";

const CollectionsPage = () => {
  const { t } = useTranslation();
  const { data: collections, isLoading } = useCollections();

  return (
    <CatalogIndexGrid
      stateKey="collections"
      emptyMessage={t("games.collectionsPage.emptyMessage")}
      countKey="games.collectionsPage.count"
      searchLabel={t("games.collectionsPage.searchLabel")}
      searchPlaceholder={t("games.collectionsPage.searchPlaceholder")}
      entries={collections}
      isLoading={isLoading}
      getCount={(entry) => entry.gameCount}
      tableColumns={[
        { key: "games", label: t("games.listView.columnGames"), render: (entry) => entry.gameCount },
        { key: "owned", label: t("games.platformsPage.columnOwned"), render: (entry) => entry.ownedCount },
      ]}
      statusFilter={{
        label: t("catalog.index.filterOwnership"),
        choices: [
          { value: "complete", label: t("catalog.index.filterComplete"), matches: (entry) => entry.ownedCount >= entry.gameCount },
          { value: "missing", label: t("catalog.index.filterMissing"), matches: (entry) => entry.ownedCount < entry.gameCount },
          { value: "noneOwned", label: t("catalog.index.filterNoneOwned"), matches: (entry) => entry.ownedCount === 0 },
        ],
      }}
      getHref={(entry) => `/games/collections/${entry.slug ?? ""}`}
    />
  );
};

export default CollectionsPage;
