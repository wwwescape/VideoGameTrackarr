import { useTranslation } from "react-i18next";
import { useFranchises } from "../hooks/useCatalogBrowse";
import CatalogIndexGrid from "./CatalogIndexGrid";

const SeriesPage = () => {
  const { t } = useTranslation();
  const { data: franchises, isLoading } = useFranchises();

  return (
    <CatalogIndexGrid
      stateKey="series"
      emptyMessage={t("games.seriesPage.emptyMessage")}
      searchLabel={t("games.seriesPage.searchLabel")}
      searchPlaceholder={t("games.seriesPage.searchPlaceholder")}
      entries={franchises}
      isLoading={isLoading}
      getCount={(entry) => entry.gameCount}
      getHref={(entry) => `/games/series/${entry.slug ?? ""}`}
    />
  );
};

export default SeriesPage;
