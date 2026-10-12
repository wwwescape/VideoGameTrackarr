import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePlatform } from "../hooks/useCatalogBrowse";
import CatalogBrowseGrid from "./CatalogBrowseGrid";
import NotFoundPage from "./NotFoundPage";

const PlatformPage = () => {
  const { t } = useTranslation();
  const { platformSlug } = useParams<{ platformSlug: string }>();
  const { data, isLoading, isError } = usePlatform(platformSlug);

  if (isError) {
    return (
      <NotFoundPage
        title={t("errors.platformNotFoundTitle")}
        message={t("errors.notFoundMessage")}
        actionLabel={t("errors.backTo", { page: t("nav.platforms") })}
        actionTo="/games/platforms"
      />
    );
  }

  return (
    <CatalogBrowseGrid
      kindLabel={t("games.platformPage.kindLabel")}
      name={data?.name}
      entityId={data?.id}
      isLoading={isLoading}
      slug={platformSlug}
    />
  );
};

export default PlatformPage;
