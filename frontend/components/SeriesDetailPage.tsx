import { useParams } from "react-router-dom";
import { useFranchise } from "../hooks/useCatalogBrowse";
import CatalogBrowseGrid from "./CatalogBrowseGrid";

// Named for the "Series" label users see (matches SeriesPage.tsx) — the data underneath is
// still IGDB's "Franchise" concept (useFranchise/franchise_repository etc. stay as-is).
const SeriesDetailPage = () => {
  const { seriesSlug } = useParams<{ seriesSlug: string }>();
  const { data, isLoading } = useFranchise(seriesSlug);

  return <CatalogBrowseGrid kindLabel="Series" name={data?.name} games={data?.games} isLoading={isLoading} />;
};

export default SeriesDetailPage;
