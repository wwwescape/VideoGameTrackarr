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
import { Section } from "./Detail";
import HardwareCard from "./HardwareCard";
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
}

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
}: HardwareListSectionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const body = isLoading ? (
    <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
  ) : !rows || rows.length === 0 ? (
    <Paper sx={{ p: 3, textAlign: "center" }}>{emptyMessage}</Paper>
  ) : view === "table" ? (
    <TableContainer
      sx={{ border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper", "& th, & td": { whiteSpace: "nowrap" } }}
    >
      <Table size="small" aria-label={title}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 56 }} />
            <TableCell>{t("games.listView.columnName")}</TableCell>
            <TableCell sx={{ width: 56 }} />
            <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{t("hardware.listToolbar.manufacturerLabel")}</TableCell>
            {!compact ? (
              <>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>{detailLabel}</TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{t("hardware.filter.columnQuantity")}</TableCell>
              </>
            ) : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
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
      items={rows}
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
