import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCollection } from "../hooks/useCatalogBrowse";
import CatalogBrowseGrid from "./CatalogBrowseGrid";
import NotFoundPage from "./NotFoundPage";

const CollectionPage = () => {
  const { t } = useTranslation();
  const { collectionSlug } = useParams<{ collectionSlug: string }>();
  const { data, isLoading, isError } = useCollection(collectionSlug);

  if (isError) {
    return (
      <NotFoundPage
        title={t("errors.collectionNotFoundTitle")}
        message={t("errors.notFoundMessage")}
        actionLabel={t("errors.backTo", { page: t("nav.collections") })}
        actionTo="/games/collections"
      />
    );
  }

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
