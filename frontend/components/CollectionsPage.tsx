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
      getHref={(entry) => `/games/collections/${entry.slug ?? ""}`}
    />
  );
};

export default CollectionsPage;
