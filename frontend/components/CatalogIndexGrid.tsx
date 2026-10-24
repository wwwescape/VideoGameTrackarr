import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Paper from "@mui/material/Paper";
import { useTranslation } from "react-i18next";
import type { CatalogSortOption } from "../api/types";
import CatalogIndexToolbar from "./CatalogIndexToolbar";
import CatalogRefCard from "./CatalogRefCard";
import VirtualGameGrid from "./VirtualGameGrid";
import { useSessionState } from "../hooks/useSessionState";
import Page from "./Page";

interface CatalogIndexEntry {
  id: number;
  name: string;
  // Shown by the default CatalogRefCard (Collections/Series).
  coverUrls?: string[];
}

interface CatalogIndexGridProps<T extends CatalogIndexEntry> {
  emptyMessage: string;
  searchLabel: string;
  searchPlaceholder: string;
  entries: T[] | undefined;
  isLoading: boolean;
  getHref: (entry: T) => string;
  // Defaults to the entry's id; Platforms needs its own, since PC has a card per storefront.
  getKey?: (entry: T) => number | string;
  // What the "Most games" sort orders by.
  getCount: (entry: T) => number;
  // Defaults to a plain name + game count CatalogRefCard.
  renderCard?: (entry: T, onClick: () => void) => ReactNode;
  estimateRowHeight?: (columns: number) => number;
  // sessionStorage key for this page's remembered search/sort (see hooks/useSessionState.ts).
  stateKey: string;
}

// Shared by CollectionsPage, SeriesPage and PlatformsPage — same "index of catalog refs, each
// linking to its own browse page" shape, just a different data source, card and link target.
// Search and sort are purely client-side (the full list is already fetched with no
// pagination), unlike the Games list's server-side filtering — there's no comparable dataset
// size concern here.
const CatalogIndexGrid = <T extends CatalogIndexEntry>({
  emptyMessage,
  searchLabel,
  searchPlaceholder,
  entries,
  isLoading,
  getHref,
  getKey,
  getCount,
  renderCard,
  estimateRowHeight,
  stateKey,
}: CatalogIndexGridProps<T>) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchKeyword, setSearchKeyword] = useSessionState(`${stateKey}.searchKeyword`, "");
  const [sort, setSort] = useSessionState<CatalogSortOption>(`${stateKey}.sort`, "name_asc");

  const visibleEntries = useMemo(() => {
    if (!entries) return [];
    const trimmed = searchKeyword.trim().toLowerCase();
    const filtered = trimmed
      ? entries.filter((entry) => entry.name.toLowerCase().includes(trimmed))
      : entries;
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "name_desc") sorted.reverse();
    // Stable sort, so entries with the same count stay in name order.
    if (sort === "count_desc") sorted.sort((a, b) => getCount(b) - getCount(a));
    return sorted;
  }, [entries, searchKeyword, sort, getCount]);

  return (
    <Page>
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
          getKey={getKey ?? ((entry) => entry.id)}
          // Defaults to VirtualGameGrid's own estimate, which fits CatalogRefCard's cover grid.
          estimateRowHeight={estimateRowHeight}
          renderItem={(entry) => {
            const onClick = () => navigate(getHref(entry));
            return renderCard ? (
              renderCard(entry, onClick)
            ) : (
              <CatalogRefCard
                name={entry.name}
                gameCount={getCount(entry)}
                coverUrls={entry.coverUrls ?? []}
                onClick={onClick}
              />
            );
          }}
        />
      )}
    </Page>
  );
};

export default CatalogIndexGrid;
