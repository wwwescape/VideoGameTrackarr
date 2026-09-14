import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { CatalogRefSummary, CatalogSortOption } from "../api/types";
import CatalogIndexToolbar from "./CatalogIndexToolbar";
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
  searchLabel: string;
  searchPlaceholder: string;
  entries: CatalogRefSummary[] | undefined;
  isLoading: boolean;
  getHref: (entry: CatalogRefSummary) => string;
}

// Shared by CollectionsPage and SeriesPage — same "index of catalog refs, each linking to
// its own browse page" shape, just a different data source and link target. Search and sort
// are purely client-side (the full list is already fetched with no pagination), unlike the
// Games list's server-side filtering — there's no comparable dataset size concern here.
const CatalogIndexGrid = ({
  title,
  description,
  emptyMessage,
  searchLabel,
  searchPlaceholder,
  entries,
  isLoading,
  getHref,
}: CatalogIndexGridProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [sort, setSort] = useState<CatalogSortOption>("name_asc");

  const visibleEntries = useMemo(() => {
    if (!entries) return [];
    const trimmed = searchKeyword.trim().toLowerCase();
    const filtered = trimmed
      ? entries.filter((entry) => entry.name.toLowerCase().includes(trimmed))
      : entries;
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "name_desc") sorted.reverse();
    return sorted;
  }, [entries, searchKeyword, sort]);

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
      <CatalogIndexToolbar
        searchLabel={searchLabel}
        searchPlaceholder={searchPlaceholder}
        searchKeyword={searchKeyword}
        onSearchKeywordChange={setSearchKeyword}
        sort={sort}
        onSortChange={setSort}
      />
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : !entries || entries.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{emptyMessage}</Paper>
      ) : visibleEntries.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.listToolbar.noSearchMatches")}</Paper>
      ) : (
        <VirtualGameGrid
          items={visibleEntries}
          getKey={(entry) => entry.id}
          estimateRowHeight={(columns) => CATALOG_REF_CARD_HEIGHT_BY_COLUMNS[columns] ?? 90}
          renderItem={(entry) => (
            <CatalogRefCard
              name={entry.name}
              gameCount={entry.gameCount}
              onClick={() => navigate(getHref(entry))}
            />
          )}
        />
      )}
    </>
  );
};

export default CatalogIndexGrid;
