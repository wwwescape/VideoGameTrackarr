import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { OnSaleItem } from "../api/types";
import type { ListSortControl } from "../hooks/useListSort";
import { formatCurrency } from "../utils/currency";
import { gameIdentifier } from "../utils/identifiers";
import { isAddon } from "../utils/utils";
import GameCard from "./GameCard";
import { SortHeaderCell } from "./ListControls";
import type { OnSaleSort } from "./OnSalePage";

export type OnSaleView = "covers" | "table";

interface OnSaleSectionProps {
  // Already searched, filtered and sorted by the page.
  items: OnSaleItem[];
  view: OnSaleView;
  cardSize: number;
  // The page's sort, which the table's headers change.
  sort: ListSortControl<OnSaleSort>;
}

// "Target hit", the size of the card's own chips (a default small Chip is taller and heavier
// than the 11px text around it).
export const TargetHitChip = () => {
  const { t } = useTranslation();
  return (
    <Box
      component="span"
      sx={{
        flexShrink: 0,
        height: 18,
        px: 0.75,
        borderRadius: 999,
        bgcolor: "#2f9e6c",
        color: "#fff",
        fontSize: 10.5,
        fontWeight: 650,
        lineHeight: "18px",
        whiteSpace: "nowrap",
      }}
    >
      {t("insights.onSale.targetHitLabel")}
    </Box>
  );
};

// One line of the tile's details: never wraps, ends in "…" on a narrow card, with the full
// text on hover.
const DetailLine = ({
  children,
  title,
  strong,
}: {
  children: ReactNode;
  title: string;
  strong?: boolean;
}) => (
  <Box
    title={title}
    sx={{
      fontSize: 12,
      lineHeight: "18px",
      color: strong ? "text.primary" : "text.secondary",
      fontWeight: strong ? 600 : 400,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    }}
  >
    {children}
  </Box>
);

// A wishlisted game on sale: the card, then up to four one-line rows — price and discount,
// store, historical low, target (with "Target hit") — so every card size stays tidy.
export const OnSaleTile = ({ item }: { item: OnSaleItem }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addon = isAddon(item.game);
  const price = formatCurrency(item.currentPriceAmount, item.currentPriceCurrency ?? "USD");
  const discount = item.currentCut
    ? t("insights.onSale.discountLabel", { cut: item.currentCut })
    : null;
  const shop = item.currentShopName ?? t("common.unknown");
  const historicalLow =
    item.historicalLowAmount !== null
      ? t("insights.onSale.historicalLowLabel", {
          price: formatCurrency(item.historicalLowAmount, item.historicalLowCurrency ?? "USD"),
        })
      : null;
  const target =
    item.targetPrice !== null
      ? t("insights.onSale.targetPriceLabel", {
          price: formatCurrency(item.targetPrice, item.currentPriceCurrency ?? "USD"),
        })
      : null;

  return (
    <Box>
      <GameCard
        game={{ ...item.game, wishlisted: true, isOnSale: true }}
        context={addon ? "addon" : "list"}
        contextFunction={() =>
          navigate(`/${addon ? "addon" : "game"}/${gameIdentifier(item.game)}`)
        }
        reservePlayStatus={false}
      />
      <Box sx={{ mt: 0.75 }}>
        <DetailLine strong title={discount ? `${price} ${discount}` : price}>
          {price}
          {discount ? (
            <Box component="span" sx={{ color: "success.main", ml: 0.75 }}>
              {discount}
            </Box>
          ) : null}
        </DetailLine>
        <DetailLine title={shop}>{shop}</DetailLine>
        {historicalLow ? <DetailLine title={historicalLow}>{historicalLow}</DetailLine> : null}
        {target ? (
          // On a card too narrow for both, "Target hit" drops onto its own line rather than
          // cutting the target price short.
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              columnGap: 0.75,
              rowGap: 0.25,
            }}
          >
            <Box sx={{ minWidth: 0, maxWidth: "100%" }}>
              <DetailLine title={target}>{target}</DetailLine>
            </Box>
            {item.isTargetHit ? <TargetHitChip /> : null}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
};

const OnSaleSection = ({ items, view, cardSize, sort }: OnSaleSectionProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const open = (item: OnSaleItem) =>
    navigate(`/${isAddon(item.game) ? "addon" : "game"}/${gameIdentifier(item.game)}`);

  if (view === "table") {
    const price = (amount: number, currency: string | null) =>
      formatCurrency(amount, currency ?? "USD");
    return (
      <TableContainer
        sx={{
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.paper",
          "& th, & td": { whiteSpace: "nowrap" },
        }}
      >
        <Table size="small" aria-label={t("insights.dashboard.onSaleHeading")}>
          <TableHead>
            <TableRow>
              <SortHeaderCell field="name" sort={sort.sort} onSort={sort.clickHeader}>
                {t("games.listView.columnName")}
              </SortHeaderCell>
              <SortHeaderCell
                field="price"
                sort={sort.sort}
                onSort={sort.clickHeader}
                align="right"
              >
                {t("insights.onSale.columnPrice")}
              </SortHeaderCell>
              <SortHeaderCell
                field="discount"
                sort={sort.sort}
                onSort={sort.clickHeader}
                align="right"
              >
                {t("insights.onSale.columnDiscount")}
              </SortHeaderCell>
              <SortHeaderCell field="store" sort={sort.sort} onSort={sort.clickHeader}>
                {t("insights.onSale.columnStore")}
              </SortHeaderCell>
              <SortHeaderCell
                field="historical_low"
                sort={sort.sort}
                onSort={sort.clickHeader}
                align="right"
                sx={{ display: { xs: "none", sm: "table-cell" } }}
              >
                {t("insights.onSale.columnHistoricalLow")}
              </SortHeaderCell>
              <SortHeaderCell
                field="target"
                sort={sort.sort}
                onSort={sort.clickHeader}
                align="right"
                sx={{ display: { xs: "none", sm: "table-cell" } }}
              >
                {t("insights.onSale.columnTarget")}
              </SortHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.libraryItemId}
                hover
                tabIndex={0}
                aria-label={item.game.name}
                onClick={() => open(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") open(item);
                }}
                sx={{
                  cursor: "pointer",
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: -2,
                  },
                }}
              >
                <TableCell
                  sx={{
                    fontWeight: 600,
                    maxWidth: 360,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.game.name}
                </TableCell>
                <TableCell align="right">
                  {price(item.currentPriceAmount, item.currentPriceCurrency)}
                </TableCell>
                <TableCell align="right" sx={{ color: "text.secondary" }}>
                  {item.currentCut !== null ? `-${item.currentCut}%` : "—"}
                </TableCell>
                <TableCell sx={{ color: "text.secondary" }}>
                  {item.currentShopName ?? t("common.unknown")}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ color: "text.secondary", display: { xs: "none", sm: "table-cell" } }}
                >
                  {item.historicalLowAmount !== null
                    ? price(item.historicalLowAmount, item.historicalLowCurrency)
                    : "—"}
                </TableCell>
                <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>
                  {item.targetPrice !== null ? (
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{ alignItems: "center", justifyContent: "flex-end" }}
                    >
                      <span>{price(item.targetPrice, item.currentPriceCurrency)}</span>
                      {item.isTargetHit ? <TargetHitChip /> : null}
                    </Stack>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return (
    // Two columns on phones, then as many cards of the chosen size as fit.
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, minmax(0, 1fr))",
          sm: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`,
        },
        gap: "18px 14px",
      }}
    >
      {items.map((item) => (
        <OnSaleTile key={item.libraryItemId} item={item} />
      ))}
    </Box>
  );
};

export default OnSaleSection;
