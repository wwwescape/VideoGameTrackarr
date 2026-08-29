import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFranchise } from "../hooks/useCatalogBrowse";
import CatalogBrowseGrid from "./CatalogBrowseGrid";
import NotFoundPage from "./NotFoundPage";

// Named for the "Series" label users see (matches SeriesPage.tsx) — the data underneath is
// still IGDB's "Franchise" concept (useFranchise/franchise_repository etc. stay as-is).
const SeriesDetailPage = () => {
  const { t } = useTranslation();
  const { seriesSlug } = useParams<{ seriesSlug: string }>();
  const { data, isLoading, isError } = useFranchise(seriesSlug);

  if (isError) {
    return (
      <NotFoundPage
        title={t("errors.seriesNotFoundTitle")}
        message={t("errors.notFoundMessage")}
        actionLabel={t("errors.backTo", { page: t("nav.series") })}
        actionTo="/games/series"
      />
    );
  }

  return (
    <CatalogBrowseGrid
      kindLabel={t("games.seriesDetailPage.kindLabel")}
      name={data?.name}
      games={data?.games}
      isLoading={isLoading}
    />
  );
};

export default SeriesDetailPage;
