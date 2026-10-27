import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import CheckIcon from "@mui/icons-material/Check";
import FavoriteIcon from "@mui/icons-material/Favorite";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import type { ListSortControl } from "../hooks/useListSort";
import { libraryRank, sortRows, type SortValue } from "../utils/listSort";
import { Section } from "./Detail";
import HardwareCard from "./HardwareCard";
import { SortHeaderCell } from "./ListControls";
import { STICKY_TOP } from "./Page";
import VirtualGameGrid from "./VirtualGameGrid";

export type HardwareListView = "cards" | "table";

// A device or accessory as both lists show it.
export interface HardwareRow {
  id: number;
  name: string;
  manufacturer: string;
  // Device: its platform. Accessory: its type.
  detail: string | null;
  imageUrl: string | null;
  owned: boolean;
  wishlisted: boolean;
  ownedQuantity: number;
  href: string;
  createdAt: string;
  // Accessories only (a year); devices have none of their own.
  releaseDate?: number | null;
}

export type HardwareSortField =
  | "name"
  | "manufacturer"
  | "detail"
  | "library"
  | "quantity"
  | "date_added"
  | "release_date";

const HARDWARE_SORT_VALUES: Record<HardwareSortField, (row: HardwareRow) => SortValue> = {
  name: (row) => row.name,
  manufacturer: (row) => row.manufacturer,
  detail: (row) => row.detail,
  library: libraryRank,
  quantity: (row) => (row.owned ? row.ownedQuantity : null),
  date_added: (row) => Date.parse(row.createdAt),
  release_date: (row) => row.releaseDate,
};

interface HardwareListSectionProps {
  id: string;
  title: string;
  rows: HardwareRow[] | undefined;
  isLoading: boolean;
  emptyMessage: string;
  detailLabel: string;
  view: HardwareListView;
  cardSize: number;
  // Rows with no type/platform or quantity to show (Orphaned accessories): those table columns
  // are left out.
  compact?: boolean;
  // The page's sort: it orders the cards and table, and the table's headers change it.
  sort: ListSortControl<HardwareSortField>;
}

// The Devices or Accessories section of the Hardware page: its count, then cards or a table.
export function HardwareListSection({
  id,
  title,
  rows,
  isLoading,
  emptyMessage,
  detailLabel,
  view,
  cardSize,
  compact = false,
  sort,
}: HardwareListSectionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sortedRows = useMemo(
    () => (rows ? sortRows(rows, sort.sort, HARDWARE_SORT_VALUES, (row) => row.name) : undefined),
    [rows, sort.sort]
  );
  // Only the fields the page's Sort menu offers sort from a header (Orphaned accessories are
  // all owned, so its Library column doesn't).
  const header = (field: HardwareSortField, label: string, sx?: object) =>
    sort.fields.some((option) => option.field === field) ? (
      <SortHeaderCell field={field} sort={sort.sort} onSort={sort.clickHeader} sx={sx}>
        {label}
      </SortHeaderCell>
    ) : (
      <TableCell sx={sx}>{label}</TableCell>
    );

  const body = isLoading ? (
    <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
  ) : !sortedRows || sortedRows.length === 0 ? (
    <Paper sx={{ p: 3, textAlign: "center" }}>{emptyMessage}</Paper>
  ) : view === "table" ? (
    <TableContainer
      sx={{ border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper", "& th, & td": { whiteSpace: "nowrap" } }}
    >
      <Table size="small" aria-label={title}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 56 }} />
            {header("name", t("games.listView.columnName"))}
            {header("library", t("games.listView.columnLibrary"))}
            {header("manufacturer", t("hardware.listToolbar.manufacturerLabel"), { display: { xs: "none", sm: "table-cell" } })}
            {!compact ? (
              <>
                {header("detail", detailLabel, { display: { xs: "none", md: "table-cell" } })}
                {header("quantity", t("hardware.filter.columnQuantity"), { display: { xs: "none", sm: "table-cell" } })}
              </>
            ) : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow
              key={row.id}
              hover
              tabIndex={0}
              aria-label={row.name}
              onClick={() => navigate(row.href)}
              onKeyDown={(event) => {
                if (event.key === "Enter") navigate(row.href);
              }}
              sx={{ cursor: "pointer", "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 } }}
            >
              <TableCell sx={{ py: 0.5 }}>
                <Box
                  sx={{
                    width: 40,
                    aspectRatio: "4 / 3",
                    borderRadius: 1,
                    overflow: "hidden",
                    bgcolor: row.imageUrl ? "#fff" : "vgt.surface2",
                    outline: "1px solid",
                    outlineColor: "divider",
                    outlineOffset: "-1px",
                  }}
                >
                  {row.imageUrl ? (
                    <Box
                      component="img"
                      src={resolveAssetUrl(row.imageUrl) ?? undefined}
                      alt=""
                      loading="lazy"
                      sx={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                    />
                  ) : null}
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</TableCell>
              <TableCell>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  {row.owned ? (
                    <CheckIcon titleAccess={t("ownershipBadges.ownedTooltip")} sx={{ fontSize: 17, color: "vgt.owned" }} />
                  ) : null}
                  {row.wishlisted ? (
                    <FavoriteIcon titleAccess={t("ownershipBadges.wishlistTooltip")} sx={{ fontSize: 16, color: "vgt.wishlist" }} />
                  ) : null}
                </Box>
              </TableCell>
              <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, color: "text.secondary" }}>{row.manufacturer}</TableCell>
              {!compact ? (
                <>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" }, color: "text.secondary" }}>{row.detail ?? "—"}</TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, color: "text.secondary" }}>
                    {row.owned ? row.ownedQuantity : "—"}
                  </TableCell>
                </>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  ) : (
    <VirtualGameGrid
      items={sortedRows}
      getKey={(row) => row.id}
      minItemWidth={cardSize}
      scrollPaddingStart={STICKY_TOP.sm + 12}
      renderItem={(row) => (
        <HardwareCard
          name={row.name}
          subtitle={[row.manufacturer, row.detail].filter(Boolean).join(" · ")}
          imageUrl={row.imageUrl}
          owned={row.owned}
          wishlisted={row.wishlisted}
          ownedQuantity={row.ownedQuantity}
          onClick={() => navigate(row.href)}
        />
      )}
    />
  );

  return (
    <Section
      id={id}
      title={title}
      action={rows && !isLoading ? <Box sx={{ color: "vgt.text3", fontSize: 12.5, fontWeight: 600 }}>{rows.length}</Box> : undefined}
    >
      {body}
    </Section>
  );
}
