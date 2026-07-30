import { useTranslation } from "react-i18next";
import { useCollections } from "../hooks/useCatalogBrowse";
import CatalogIndexGrid from "./CatalogIndexGrid";
import GamesSubNav from "./GamesSubNav";

const CollectionsPage = () => {
  const { t } = useTranslation();
  const { data: collections, isLoading } = useCollections();

  return (
    <>
      <GamesSubNav />
      <CatalogIndexGrid
        title={t("games.collectionsPage.title")}
        description={t("games.collectionsPage.description")}
        emptyMessage={t("games.collectionsPage.emptyMessage")}
        entries={collections}
        isLoading={isLoading}
        getHref={(entry) => `/games/collections/${entry.slug ?? ""}`}
      />
    </>
  );
};

export default CollectionsPage;
