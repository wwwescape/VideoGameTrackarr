import { useFranchises } from "../hooks/useCatalogBrowse";
import CatalogIndexGrid from "./CatalogIndexGrid";
import GamesSubNav from "./GamesSubNav";

const SeriesPage = () => {
  const { data: franchises, isLoading } = useFranchises();

  return (
    <>
      <GamesSubNav />
      <CatalogIndexGrid
        title="Series"
        description="Game series (IGDB franchises) with at least one game in your library."
        emptyMessage="No series yet — they show up here once you've imported a game that belongs to one."
        entries={franchises}
        isLoading={isLoading}
        getHref={(entry) => `/games/series/${entry.slug ?? ""}`}
      />
    </>
  );
};

export default SeriesPage;
