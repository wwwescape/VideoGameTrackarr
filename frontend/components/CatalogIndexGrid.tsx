import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { CatalogRefSummary } from "../api/types";
import CatalogRefCard from "./CatalogRefCard";
import VirtualGameGrid from "./VirtualGameGrid";

// Tiles are just a name + a game count — much shorter than a cover-art GameCard, so the
// default cover-art height guess (VirtualGameGrid's ESTIMATED_ROW_HEIGHT_BY_COLUMNS) would
// overshoot badly on first paint.
const CATALOG_REF_CARD_HEIGHT_BY_COLUMNS: Record<number, number> = {
  2: 96,
  3: 92,
  4: 88,
  6: 84,
};

interface CatalogIndexGridProps {
  title: string;
  description: string;
  emptyMessage: string;
  entries: CatalogRefSummary[] | undefined;
  isLoading: boolean;
  getHref: (entry: CatalogRefSummary) => string;
}

// Shared by CollectionsPage and SeriesPage — same "index of catalog refs, each linking to
// its own browse page" shape, just a different data source and link target.
const CatalogIndexGrid = ({ title, description, emptyMessage, entries, isLoading, getHref }: CatalogIndexGridProps) => {
  const navigate = useNavigate();

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Box>
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>Loading...</Paper>
      ) : !entries || entries.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{emptyMessage}</Paper>
      ) : (
        <VirtualGameGrid
          items={entries}
          getKey={(entry) => entry.id}
          estimateRowHeight={(columns) => CATALOG_REF_CARD_HEIGHT_BY_COLUMNS[columns] ?? 90}
          renderItem={(entry) => (
            <CatalogRefCard name={entry.name} gameCount={entry.gameCount} onClick={() => navigate(getHref(entry))} />
          )}
        />
      )}
    </>
  );
};

export default CatalogIndexGrid;
