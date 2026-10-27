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
      countKey="games.seriesPage.count"
      searchLabel={t("games.seriesPage.searchLabel")}
      searchPlaceholder={t("games.seriesPage.searchPlaceholder")}
      entries={franchises}
      isLoading={isLoading}
      getCount={(entry) => entry.gameCount}
      tableColumns={[
        { key: "games", label: t("games.listView.columnGames"), render: (entry) => entry.gameCount, sortValue: (entry) => entry.gameCount },
        { key: "owned", label: t("games.platformsPage.columnOwned"), render: (entry) => entry.ownedCount, sortValue: (entry) => entry.ownedCount },
      ]}
      statusFilter={{
        label: t("catalog.index.filterOwnership"),
        choices: [
          { value: "complete", label: t("catalog.index.filterComplete"), matches: (entry) => entry.ownedCount >= entry.gameCount },
          { value: "missing", label: t("catalog.index.filterMissing"), matches: (entry) => entry.ownedCount < entry.gameCount },
          { value: "noneOwned", label: t("catalog.index.filterNoneOwned"), matches: (entry) => entry.ownedCount === 0 },
        ],
      }}
      getHref={(entry) => `/games/series/${entry.slug ?? ""}`}
    />
  );
};

export default SeriesPage;
