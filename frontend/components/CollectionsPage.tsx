import { useCollections } from "../hooks/useCatalogBrowse";
import CatalogIndexGrid from "./CatalogIndexGrid";
import GamesSubNav from "./GamesSubNav";

const CollectionsPage = () => {
  const { data: collections, isLoading } = useCollections();

  return (
    <>
      <GamesSubNav />
      <CatalogIndexGrid
        title="Collections"
        description="IGDB collections with at least one game in your library."
        emptyMessage="No collections yet — they show up here once you've imported a game that belongs to one."
        entries={collections}
        isLoading={isLoading}
        getHref={(entry) => `/games/collections/${entry.slug ?? ""}`}
      />
    </>
  );
};

export default CollectionsPage;
