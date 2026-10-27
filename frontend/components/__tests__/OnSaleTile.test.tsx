import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { OnSaleItem } from "../../api/types";
import { createVgtTheme } from "../../theme/createVgtTheme";
import { OnSaleTile } from "../OnSaleSection";

const item = (overrides: Partial<OnSaleItem> = {}): OnSaleItem => ({
  libraryItemId: 1,
  game: {
    id: 1,
    uuid: "uuid-1",
    name: "MLB The Show 26",
    slug: null,
    coverUrl: null,
    category: "main_game",
    firstReleaseDate: null,
    owned: false,
    wishlisted: true,
    autoDiscovered: false,
  },
  currentPriceAmount: 1799,
  currentPriceCurrency: "USD",
  currentShopName: "PlayStation Store",
  currentCut: 40,
  historicalLowAmount: 1799,
  historicalLowCurrency: "USD",
  historicalLowShopName: null,
  historicalLowAt: null,
  targetPrice: 1999,
  isTargetHit: true,
  ...overrides,
});

const renderTile = (onSale: OnSaleItem) =>
  render(
    <ThemeProvider theme={createVgtTheme("dark", "normal", "#7c4dff")}>
      <MemoryRouter>
        <OnSaleTile item={onSale} />
      </MemoryRouter>
    </ThemeProvider>
  );

describe("OnSaleTile", () => {
  it("shows price and discount, store, historical low and target on their own lines", () => {
    renderTile(item());

    expect(screen.getByTitle("$1,799.00 -40%")).toBeInTheDocument();
    expect(screen.getByTitle("PlayStation Store")).toBeInTheDocument();
    expect(screen.getByTitle("Historical low: $1,799.00")).toBeInTheDocument();
    expect(screen.getByTitle("Target: $1,999.00")).toBeInTheDocument();
    expect(screen.getByText("Target hit")).toBeInTheDocument();
  });

  it("leaves out the rows it has nothing for", () => {
    renderTile(
      item({ currentCut: null, historicalLowAmount: null, targetPrice: null, isTargetHit: false })
    );

    expect(screen.getByTitle("$1,799.00")).toBeInTheDocument();
    expect(screen.queryByText(/Historical low/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Target/)).not.toBeInTheDocument();
  });
});
