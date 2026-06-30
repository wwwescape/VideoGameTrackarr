import { useParams } from "react-router-dom";
import { useCollection } from "../hooks/useCatalogBrowse";
import CatalogBrowseGrid from "./CatalogBrowseGrid";

const CollectionPage = () => {
  const { collectionSlug } = useParams<{ collectionSlug: string }>();
  const { data, isLoading } = useCollection(collectionSlug);

  return <CatalogBrowseGrid kindLabel="Collection" name={data?.name} games={data?.games} isLoading={isLoading} />;
};

export default CollectionPage;
