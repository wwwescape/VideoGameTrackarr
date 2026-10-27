import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import GridViewIcon from "@mui/icons-material/GridView";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
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
import { useListSort } from "../hooks/useListSort";
import { useLocalPreference } from "../hooks/useLocalPreference";
import { useSessionState } from "../hooks/useSessionState";
import { sortRows, type SortField, type SortValue } from "../utils/listSort";
import CatalogRefCard from "./CatalogRefCard";
import { CARD_SIZE_DEFAULT } from "./GameListViews";
import { CardSizeSlider, ChoiceMenu, ListSearchField, SortHeaderCell, SortMenu, type MenuChoice } from "./ListControls";
import { FilterChips, FilterDialog, ToggleFilter } from "./ListToolbar";
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
  // Makes the column sortable (its header and the Sort menu), highest first to start.
  sortValue?: (entry: T) => SortValue;
}

export interface CatalogIndexFilter<T> {
  label: string;
  choices: { value: string; label: string; matches: (entry: T) => boolean }[];
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
  // The default card's and table's game count.
  getCount: (entry: T) => number;
  // Defaults to a plain name + game count CatalogRefCard.
  renderCard?: (entry: T, onClick: () => void) => ReactNode;
  estimateRowHeight?: (columns: number) => number;
  // The Table view's columns after the name. Defaults to the game count.
  tableColumns?: CatalogIndexColumn<T>[];
  // The Filter: one pick-one choice (besides All), each saying which entries it keeps.
  statusFilter?: CatalogIndexFilter<T>;
  // sessionStorage key for this page's remembered search/sort (see hooks/useSessionState.ts),
  // and the localStorage key for its view and card size.
  stateKey: string;
}

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
  statusFilter,
  stateKey,
}: CatalogIndexGridProps<T>) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchKeyword, setSearchKeyword] = useSessionState(`${stateKey}.searchKeyword`, "");
  const [view, setView] = useLocalPreference<CatalogIndexView>(`${stateKey}.view`, "cards");
  const [cardSize, setCardSize] = useLocalPreference(`${stateKey}.cardSize`, CARD_SIZE_DEFAULT);
  const [menu, setMenu] = useState<{ name: "options" | "view" | "sort"; anchor: HTMLElement } | null>(null);
  const [status, setStatus] = useSessionState(`${stateKey}.status`, "all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeStatus = statusFilter?.choices.find((choice) => choice.value === status);

  const columns: CatalogIndexColumn<T>[] = tableColumns ?? [
    { key: "games", label: t("games.listView.columnGames"), render: (entry) => getCount(entry), sortValue: getCount },
  ];
  // Name, then every sortable table column (the counts), in the table's order. The game count
  // (getCount) is always offered: as its own column, or for Platforms (Owned + Wishlisted
  // columns) in the Sort menu only.
  const sortColumns = columns.filter((column) => column.sortValue);
  const countField = sortColumns.some((column) => column.key === "games")
    ? []
    : [{ field: "games", label: t("games.listView.columnGames"), defaultDirection: "desc" as const }];
  const sortFields: SortField<string>[] = [
    { field: "name", label: t("games.listView.columnName") },
    ...sortColumns.map((column) => ({ field: column.key, label: column.label, defaultDirection: "desc" as const })),
    ...countField,
  ];
  const sort = useListSort(`${stateKey}.sortBy`, sortFields, { field: "name", direction: "asc" });

  const visibleEntries = useMemo(() => {
    if (!entries) return [];
    const trimmed = searchKeyword.trim().toLowerCase();
    const filtered = entries.filter(
      (entry) => (!trimmed || entry.name.toLowerCase().includes(trimmed)) && (!activeStatus || activeStatus.matches(entry))
    );
    const values: Record<string, (entry: T) => SortValue> = { name: (entry) => entry.name, games: getCount };
    sortColumns.forEach((column) => (values[column.key] = column.sortValue!));
    return sortRows(filtered, sort.sort, values, (entry) => entry.name);
  }, [entries, searchKeyword, sort.sort, activeStatus, sortColumns, getCount]);

  const keyOf = getKey ?? ((entry: T) => entry.id);
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
      {statusFilter ? (
        <ToolbarButton
          icon={<FilterAltOutlinedIcon />}
          label={t("games.listView.filter")}
          count={activeStatus ? 1 : 0}
          active={!!activeStatus}
          onClick={() => setFiltersOpen(true)}
        />
      ) : null}
    </>
  );

  const renderTable = () => (
    <TableContainer
      sx={{ border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper", "& th, & td": { whiteSpace: "nowrap" } }}
    >
      <Table size="small" aria-label={searchLabel}>
        <TableHead>
          <TableRow>
            <SortHeaderCell field="name" sort={sort.sort} onSort={sort.clickHeader}>
              {t("games.listView.columnName")}
            </SortHeaderCell>
            {columns.map((column) => {
              const sx = column.hideOnPhone ? { display: { xs: "none", sm: "table-cell" } } : undefined;
              return column.sortValue ? (
                <SortHeaderCell key={column.key} field={column.key} sort={sort.sort} onSort={sort.clickHeader} sx={sx}>
                  {column.label}
                </SortHeaderCell>
              ) : (
                <TableCell key={column.key} sx={sx}>
                  {column.label}
                </TableCell>
              );
            })}
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
      <FilterChips
        chips={activeStatus ? [{ key: "status", label: activeStatus.label, onRemove: () => setStatus("all") }] : []}
      />
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
      <SortMenu
        anchor={menu?.name === "sort" ? menu.anchor : null}
        onClose={closeMenu}
        fields={sortFields.map((option) => ({ value: option.field, label: option.label }))}
        field={sort.sort.field}
        direction={sort.sort.direction}
        onFieldChange={sort.pickField}
        onDirectionChange={sort.setDirection}
      />
      {statusFilter ? (
        <FilterDialog
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          onClear={() => setStatus("all")}
          activeCount={activeStatus ? 1 : 0}
        >
          <ToggleFilter
            id={`${stateKey}-status`}
            label={statusFilter.label}
            value={activeStatus ? status : "all"}
            onChange={setStatus}
            options={[
              { value: "all", label: t("games.listToolbar.allOption") },
              ...statusFilter.choices.map(({ value, label }) => ({ value, label })),
            ]}
          />
        </FilterDialog>
      ) : null}
    </Page>
  );
};

export default CatalogIndexGrid;
