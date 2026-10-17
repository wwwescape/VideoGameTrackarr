import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePlatform } from "../hooks/usePlatforms";
import { parsePlatformScope, platformDisplayName } from "../utils/platformScope";
import CatalogBrowseGrid from "./CatalogBrowseGrid";
import NotFoundPage from "./NotFoundPage";

const PlatformDetailPage = () => {
  const { t } = useTranslation();
  const { platformSlug } = useParams<{ platformSlug: string }>();
  const [searchParams] = useSearchParams();
  // A PC storefront card's page: ?format=digital&storefront=Steam.
  const scope = parsePlatformScope(searchParams);
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
      kind="platform"
      kindLabel={t("games.platformDetailPage.kindLabel")}
      name={data ? platformDisplayName(data, scope, t) : undefined}
      entityId={data?.id}
      isLoading={isLoading}
      slug={platformSlug}
      platformScope={scope}
    />
  );
};

export default PlatformDetailPage;
