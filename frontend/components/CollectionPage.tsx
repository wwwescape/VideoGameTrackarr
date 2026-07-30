import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCollection } from "../hooks/useCatalogBrowse";
import CatalogBrowseGrid from "./CatalogBrowseGrid";

const CollectionPage = () => {
  const { t } = useTranslation();
  const { collectionSlug } = useParams<{ collectionSlug: string }>();
  const { data, isLoading } = useCollection(collectionSlug);

  return (
    <CatalogBrowseGrid
      kindLabel={t("games.collectionPage.kindLabel")}
      name={data?.name}
      games={data?.games}
      isLoading={isLoading}
    />
  );
};

export default CollectionPage;
