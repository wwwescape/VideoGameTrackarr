import { useTranslation } from "react-i18next";
import { useFranchises } from "../hooks/useCatalogBrowse";
import CatalogIndexGrid from "./CatalogIndexGrid";
import GamesSubNav from "./GamesSubNav";

const SeriesPage = () => {
  const { t } = useTranslation();
  const { data: franchises, isLoading } = useFranchises();

  return (
    <>
      <GamesSubNav />
      <CatalogIndexGrid
        title={t("games.seriesPage.title")}
        description={t("games.seriesPage.description")}
        emptyMessage={t("games.seriesPage.emptyMessage")}
        entries={franchises}
        isLoading={isLoading}
        getHref={(entry) => `/games/series/${entry.slug ?? ""}`}
      />
    </>
  );
};

export default SeriesPage;
