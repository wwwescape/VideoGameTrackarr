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
  // Overrides "highest first" (a set number reads lowest first).
  defaultDirection?: "asc" | "desc";
}

export interface CatalogIndexFilter<T> {
  label: string;
  choices: { value: string; label: string; matches: (entry: T) => boolean }[];
}

// A filter beside statusFilter (a toy's pack type), remembered under its own key.
export interface CatalogIndexExtraFilter<T> extends CatalogIndexFilter<T> {
  key: string;
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
  // The default card's and table's game count. Leave it out for entries that aren't groups of
  // games (Toys-to-Life packs): no game count column or sort then.
  getCount?: (entry: T) => number;
  // What search matches against. Defaults to the name.
  getSearchText?: (entry: T) => string;
  // Defaults to a plain name + game count CatalogRefCard.
  renderCard?: (entry: T, onClick: () => void) => ReactNode;
  estimateRowHeight?: (columns: number) => number;
  // The Table view's columns after the name. Defaults to the game count.
  tableColumns?: CatalogIndexColumn<T>[];
  // The Filter: one pick-one choice (besides All), each saying which entries it keeps.
  statusFilter?: CatalogIndexFilter<T>;
  extraFilters?: CatalogIndexExtraFilter<T>[];
  // The order to start with. Defaults to the name, A-Z.
  defaultSort?: { field: string; direction: "asc" | "desc" };
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
  getSearchText,
  renderCard,
  estimateRowHeight,
  tableColumns,
  statusFilter,
  extraFilters,
  defaultSort,
  stateKey,
}: CatalogIndexGridProps<T>) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchKeyword, setSearchKeyword] = useSessionState(`${stateKey}.searchKeyword`, "");
  const [view, setView] = useLocalPreference<CatalogIndexView>(`${stateKey}.view`, "cards");
  const [cardSize, setCardSize] = useLocalPreference(`${stateKey}.cardSize`, CARD_SIZE_DEFAULT);
  const [menu, setMenu] = useState<{ name: "options" | "view" | "sort"; anchor: HTMLElement } | null>(null);
  const [status, setStatus] = useSessionState(`${stateKey}.status`, "all");
  const [extraValues, setExtraValues] = useSessionState<Record<string, string>>(`${stateKey}.filters`, {});
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Every filter with its current pick; `active` is the picked choice (none for All).
  const filters = [
    ...(statusFilter ? [{ ...statusFilter, key: "status", value: status, setValue: setStatus }] : []),
    ...(extraFilters ?? []).map((filter) => ({
      ...filter,
      value: extraValues[filter.key] ?? "all",
      setValue: (value: string) => setExtraValues({ ...extraValues, [filter.key]: value }),
    })),
  ].map((filter) => ({ ...filter, active: filter.choices.find((choice) => choice.value === filter.value) }));
  const activeChoices = filters.flatMap((filter) => (filter.active ? [filter.active] : []));
  const clearFilters = () => {
    setStatus("all");
    setExtraValues({});
  };

  const columns: CatalogIndexColumn<T>[] =
    tableColumns ??
    (getCount
      ? [{ key: "games", label: t("games.listView.columnGames"), render: (entry) => getCount(entry), sortValue: getCount }]
      : []);
  // Name, then every sortable table column (the counts), in the table's order. The game count
  // (getCount) is always offered: as its own column, or for Platforms (Owned + Wishlisted
  // columns) in the Sort menu only.
  const sortColumns = columns.filter((column) => column.sortValue);
  const countField =
    !getCount || sortColumns.some((column) => column.key === "games")
      ? []
      : [{ field: "games", label: t("games.listView.columnGames"), defaultDirection: "desc" as const }];
  const sortFields: SortField<string>[] = [
    { field: "name", label: t("games.listView.columnName") },
    ...sortColumns.map((column) => ({ field: column.key, label: column.label, defaultDirection: column.defaultDirection ?? "desc" })),
    ...countField,
  ];
  const sort = useListSort(`${stateKey}.sortBy`, sortFields, defaultSort ?? { field: "name", direction: "asc" });

  const visibleEntries = useMemo(() => {
    if (!entries) return [];
    const trimmed = searchKeyword.trim().toLowerCase();
    const searchText = getSearchText ?? ((entry: T) => entry.name);
    const filtered = entries.filter(
      (entry) =>
        (!trimmed || searchText(entry).toLowerCase().includes(trimmed)) && activeChoices.every((choice) => choice.matches(entry))
    );
    const values: Record<string, (entry: T) => SortValue> = { name: (entry) => entry.name };
    if (getCount) values.games = getCount;
    sortColumns.forEach((column) => (values[column.key] = column.sortValue!));
    return sortRows(filtered, sort.sort, values, (entry) => entry.name);
    // activeChoices is rebuilt every render; what it holds only changes with status and extraValues.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, searchKeyword, sort.sort, status, extraValues, sortColumns, getCount, getSearchText]);

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
      {filters.length ? (
        <ToolbarButton
          icon={<FilterAltOutlinedIcon />}
          label={t("games.listView.filter")}
          count={activeChoices.length}
          active={activeChoices.length > 0}
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
        chips={filters.flatMap((filter) =>
          filter.active ? [{ key: filter.key, label: filter.active.label, onRemove: () => filter.setValue("all") }] : []
        )}
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
                gameCount={getCount?.(entry) ?? 0}
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
      {filters.length ? (
        <FilterDialog
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          onClear={clearFilters}
          activeCount={activeChoices.length}
        >
          {filters.map((filter) => (
            <ToggleFilter
              key={filter.key}
              id={`${stateKey}-${filter.key}`}
              label={filter.label}
              value={filter.active ? filter.value : "all"}
              onChange={filter.setValue}
              options={[
                { value: "all", label: t("games.listToolbar.allOption") },
                ...filter.choices.map(({ value, label }) => ({ value, label })),
              ]}
            />
          ))}
        </FilterDialog>
      ) : null}
    </Page>
  );
};

export default CatalogIndexGrid;
