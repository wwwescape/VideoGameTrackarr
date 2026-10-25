import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import GridViewIcon from "@mui/icons-material/GridView";
import SortIcon from "@mui/icons-material/Sort";
import TableRowsIcon from "@mui/icons-material/TableRows";
import TuneIcon from "@mui/icons-material/Tune";
import Menu from "@mui/material/Menu";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { useTranslation } from "react-i18next";
import type { CatalogSortOption } from "../api/types";
import { useLocalPreference } from "../hooks/useLocalPreference";
import { useSessionState } from "../hooks/useSessionState";
import CatalogRefCard from "./CatalogRefCard";
import { CARD_SIZE_DEFAULT } from "./GameListViews";
import { CardSizeSlider, ChoiceMenu, ListSearchField, type MenuChoice } from "./ListControls";
import Page, { STICKY_TOP, ToolbarButton } from "./Page";
import VirtualGameGrid from "./VirtualGameGrid";

interface CatalogIndexEntry {
  id: number;
  name: string;
  // Shown by the default CatalogRefCard (Collections/Series).
  coverUrls?: string[];
}

export type CatalogIndexView = "cards" | "table";

// One extra Table column after the name (Platforms: owned, wishlisted, storefront).
export interface CatalogIndexColumn<T> {
  key: string;
  label: string;
  render: (entry: T) => ReactNode;
  // Hidden on phones, to keep the table to the name and a count.
  hideOnPhone?: boolean;
}

interface CatalogIndexGridProps<T extends CatalogIndexEntry> {
  emptyMessage: string;
  // The count beside the breadcrumbs ("5 platforms"), a plural key.
  countKey: string;
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
  // The Table view's columns after the name. Defaults to the game count.
  tableColumns?: CatalogIndexColumn<T>[];
  // sessionStorage key for this page's remembered search/sort (see hooks/useSessionState.ts),
  // and the localStorage key for its view and card size.
  stateKey: string;
}

const SORT_CHOICES: { value: CatalogSortOption; labelKey: string }[] = [
  { value: "name_asc", labelKey: "games.listToolbar.sortNameAsc" },
  { value: "name_desc", labelKey: "games.listToolbar.sortNameDesc" },
  { value: "count_desc", labelKey: "games.listToolbar.sortMostGames" },
];

// Shared by CollectionsPage, SeriesPage and PlatformsPage — same "index of catalog refs, each
// linking to its own browse page" shape, just a different data source, card and link target.
// Search and sort are purely client-side (the full list is already fetched with no
// pagination), unlike the Games list's server-side filtering — there's no comparable dataset
// size concern here.
const CatalogIndexGrid = <T extends CatalogIndexEntry>({
  emptyMessage,
  countKey,
  searchLabel,
  searchPlaceholder,
  entries,
  isLoading,
  getHref,
  getKey,
  getCount,
  renderCard,
  estimateRowHeight,
  tableColumns,
  stateKey,
}: CatalogIndexGridProps<T>) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchKeyword, setSearchKeyword] = useSessionState(`${stateKey}.searchKeyword`, "");
  const [sort, setSort] = useSessionState<CatalogSortOption>(`${stateKey}.sort`, "name_asc");
  const [view, setView] = useLocalPreference<CatalogIndexView>(`${stateKey}.view`, "cards");
  const [cardSize, setCardSize] = useLocalPreference(`${stateKey}.cardSize`, CARD_SIZE_DEFAULT);
  const [menu, setMenu] = useState<{ name: "options" | "view" | "sort"; anchor: HTMLElement } | null>(null);

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

  const keyOf = getKey ?? ((entry: T) => entry.id);
  const columns: CatalogIndexColumn<T>[] = tableColumns ?? [
    { key: "games", label: t("games.listView.columnGames"), render: (entry) => getCount(entry) },
  ];
  const viewChoices: MenuChoice<CatalogIndexView>[] = [
    { value: "cards", label: t("catalog.index.viewCards"), icon: <GridViewIcon /> },
    { value: "table", label: t("games.listView.view_table"), icon: <TableRowsIcon /> },
  ];
  const closeMenu = () => setMenu(null);

  const toolbarEnd = (
    <>
      <ToolbarButton
        icon={<TuneIcon />}
        label={t("games.listView.options")}
        onClick={(event) => setMenu({ name: "options", anchor: event.currentTarget })}
        aria-haspopup="menu"
      />
      <ToolbarButton
        icon={view === "table" ? <TableRowsIcon /> : <GridViewIcon />}
        label={t("games.listView.view")}
        onClick={(event) => setMenu({ name: "view", anchor: event.currentTarget })}
        aria-haspopup="menu"
      />
      <ToolbarButton
        icon={<SortIcon />}
        label={t("games.listView.sort")}
        onClick={(event) => setMenu({ name: "sort", anchor: event.currentTarget })}
        aria-haspopup="menu"
      />
    </>
  );

  const renderTable = () => (
    <TableContainer
      sx={{ border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper", "& th, & td": { whiteSpace: "nowrap" } }}
    >
      <Table size="small" aria-label={searchLabel}>
        <TableHead>
          <TableRow>
            <TableCell>{t("games.listView.columnName")}</TableCell>
            {columns.map((column) => (
              <TableCell key={column.key} sx={column.hideOnPhone ? { display: { xs: "none", sm: "table-cell" } } : undefined}>
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {visibleEntries.map((entry) => (
            <TableRow
              key={keyOf(entry)}
              hover
              tabIndex={0}
              aria-label={entry.name}
              onClick={() => navigate(getHref(entry))}
              onKeyDown={(event) => {
                if (event.key === "Enter") navigate(getHref(entry));
              }}
              sx={{ cursor: "pointer", "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 } }}
            >
              <TableCell sx={{ fontWeight: 600, maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis" }}>{entry.name}</TableCell>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  sx={{ color: "text.secondary", ...(column.hideOnPhone ? { display: { xs: "none", sm: "table-cell" } } : {}) }}
                >
                  {column.render(entry)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Page
      meta={entries ? t(countKey, { count: visibleEntries.length }) : undefined}
      toolbarEnd={toolbarEnd}
      actions={
        <ListSearchField value={searchKeyword} onChange={setSearchKeyword} label={searchLabel} placeholder={searchPlaceholder} />
      }
    >
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : !entries || entries.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{emptyMessage}</Paper>
      ) : visibleEntries.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.listToolbar.noSearchMatches")}</Paper>
      ) : view === "table" ? (
        renderTable()
      ) : (
        <VirtualGameGrid
          items={visibleEntries}
          getKey={keyOf}
          minItemWidth={cardSize}
          scrollPaddingStart={STICKY_TOP.sm + 12}
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
      <Menu anchorEl={menu?.anchor} open={menu?.name === "options"} onClose={closeMenu}>
        <CardSizeSlider value={cardSize} onChange={setCardSize} disabled={view !== "cards"} />
      </Menu>
      <ChoiceMenu anchor={menu?.name === "view" ? menu.anchor : null} onClose={closeMenu} choices={viewChoices} selected={view} onSelect={setView} />
      <ChoiceMenu
        anchor={menu?.name === "sort" ? menu.anchor : null}
        onClose={closeMenu}
        choices={SORT_CHOICES.map((choice) => ({ value: choice.value, label: t(choice.labelKey) }))}
        selected={sort}
        onSelect={setSort}
      />
    </Page>
  );
};

export default CatalogIndexGrid;
