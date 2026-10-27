import type { ReactElement } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventSummary, InsightAccessoryRef, OnSaleItem } from "../../api/types";
import { createVgtTheme } from "../../theme/createVgtTheme";
import CatalogIndexGrid from "../CatalogIndexGrid";
import EventsPage from "../EventsPage";
import OnSalePage from "../OnSalePage";
import OrphanedAccessoriesPage from "../OrphanedAccessoriesPage";

// jsdom doesn't implement ResizeObserver, which the card grids need to mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

let onSale: OnSaleItem[];
let orphans: InsightAccessoryRef[];
let events: EventSummary[];

vi.mock("../../hooks/useInsights", () => ({
  useOnSale: () => ({ data: onSale, isLoading: false }),
  useAccessoriesWithoutOwnedHardware: () => ({ data: orphans, isLoading: false }),
}));
vi.mock("../../hooks/useEvents", () => ({ useEvents: () => ({ data: events, isLoading: false }) }));

const theme = createVgtTheme("light", "normal", "#7c4dff");
const renderPage = (ui: ReactElement) => {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );
  return userEvent.setup();
};

const sale = (
  id: number,
  name: string,
  price: number,
  cut: number,
  shop: string,
  isTargetHit = false
): OnSaleItem => ({
  libraryItemId: id,
  game: {
    id,
    uuid: `uuid-${id}`,
    name,
    slug: null,
    coverUrl: null,
    category: "main_game",
    firstReleaseDate: null,
    owned: false,
    wishlisted: true,
    autoDiscovered: false,
  },
  currentPriceAmount: price,
  currentPriceCurrency: "USD",
  currentShopName: shop,
  currentCut: cut,
  historicalLowAmount: null,
  historicalLowCurrency: null,
  historicalLowShopName: null,
  historicalLowAt: null,
  targetPrice: null,
  isTargetHit,
});

// Table rows, by their accessible name (the item's name), in order.
const tableRows = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map(
      (row) => row.getAttribute("aria-label") ?? within(row).getAllByRole("cell")[0].textContent
    );

const pick = async (user: ReturnType<typeof userEvent.setup>, button: string, item: string) => {
  await user.click(screen.getByRole("button", { name: button }));
  await user.click(screen.getByRole("menuitem", { name: item }));
};

// Closes the Filter dialog and waits until it's gone (the page is hidden from queries until then).
const closeFilters = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
};

beforeEach(() => {
  window.sessionStorage.clear();
  onSale = [
    sale(1, "Hades", 12, 50, "Steam", true),
    sale(2, "Celeste", 5, 75, "GOG"),
    sale(3, "Balatro", 9, 10, "Steam"),
  ];
  orphans = [];
  events = [];
});

describe("On Sale toolbar", () => {
  it("shows a table, sorts by price, and filters by store and target", async () => {
    const user = renderPage(<OnSalePage />);

    await pick(user, "View", "Table");
    expect(tableRows()).toEqual(["Hades", "Celeste", "Balatro"]);

    await pick(user, "Sort", "Price");
    expect(tableRows()).toEqual(["Celeste", "Balatro", "Hades"]);
    expect(screen.getByRole("columnheader", { name: "Price" })).toHaveAttribute("aria-sort", "ascending");

    // The headers change the same sort: a click flips the sorted column, another starts it.
    await user.click(screen.getByRole("button", { name: "Price" }));
    expect(tableRows()).toEqual(["Hades", "Balatro", "Celeste"]);
    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(tableRows()).toEqual(["Balatro", "Celeste", "Hades"]);
    await user.click(screen.getByRole("button", { name: "Price" }));
    expect(tableRows()).toEqual(["Celeste", "Balatro", "Hades"]);

    await user.click(screen.getByRole("button", { name: "Filter" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Target price reached" }));
    await closeFilters(user);

    expect(tableRows()).toEqual(["Hades"]);
    await user.click(screen.getByLabelText("Remove filter Target price reached"));
    expect(tableRows()).toEqual(["Celeste", "Balatro", "Hades"]);
  });
});

describe("Orphaned accessories toolbar", () => {
  it("sorts by date added and filters by type", async () => {
    orphans = [
      {
        id: 1,
        uuid: "a",
        officialName: "Arcade Stick",
        imageUrl: null,
        manufacturerName: "Hori",
        accessoryTypeName: "Controller",
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: 2,
        uuid: "b",
        officialName: "Battery Pack",
        imageUrl: null,
        manufacturerName: "Sony",
        accessoryTypeName: "Power",
        createdAt: "2026-03-01T00:00:00Z",
      },
    ];
    const user = renderPage(<OrphanedAccessoriesPage />);

    await pick(user, "View", "Table");
    await pick(user, "Sort", "Date added");
    expect(tableRows()).toEqual(["Battery Pack", "Arcade Stick"]);
    await pick(user, "Sort", "Ascending");
    expect(tableRows()).toEqual(["Arcade Stick", "Battery Pack"]);
    // Every orphan is owned, so Library isn't a sortable header here.
    expect(screen.queryByRole("button", { name: "Library" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Manufacturer" }));
    expect(tableRows()).toEqual(["Arcade Stick", "Battery Pack"]);
    await user.click(screen.getByRole("button", { name: "Manufacturer" }));
    expect(tableRows()).toEqual(["Battery Pack", "Arcade Stick"]);

    await user.click(screen.getByRole("button", { name: "Filter" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("combobox", { name: "Accessory type" }));
    await user.click(screen.getByRole("option", { name: "Controller" }));
    await closeFilters(user);

    expect(tableRows()).toEqual(["Arcade Stick"]);
  });
});

describe("Events toolbar", () => {
  it("filters to upcoming events and sorts by name", async () => {
    const now = Math.floor(Date.now() / 1000);
    events = [
      {
        id: 1,
        name: "Summer Showcase",
        slug: null,
        startTime: now - 3600,
        endTime: now + 3600,
        eventLogoUrl: null,
      },
      {
        id: 2,
        name: "Winter Direct",
        slug: null,
        startTime: now + 86400,
        endTime: now + 90000,
        eventLogoUrl: null,
      },
      {
        id: 3,
        name: "Autumn Expo",
        slug: null,
        startTime: now + 172800,
        endTime: now + 180000,
        eventLogoUrl: null,
      },
    ];
    const user = renderPage(<EventsPage />);

    expect(screen.getByRole("heading", { name: "Ongoing" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Upcoming" }));
    await closeFilters(user);
    expect(screen.queryByRole("heading", { name: "Ongoing" })).not.toBeInTheDocument();
    expect(screen.queryByText("Summer Showcase")).not.toBeInTheDocument();

    await pick(user, "Sort", "Name");
    const autumn = screen.getByText("Autumn Expo");
    const winter = screen.getByText("Winter Direct");
    expect(autumn.compareDocumentPosition(winter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("Collections/Series/Platforms Filter", () => {
  it("keeps only the entries the chosen ownership matches", async () => {
    const user = renderPage(
      <CatalogIndexGrid
        stateKey="collections"
        emptyMessage="None"
        countKey="games.collectionsPage.count"
        searchLabel="Search collections"
        searchPlaceholder="Enter collection name"
        entries={[
          { id: 1, name: "All Owned", gameCount: 2, ownedCount: 2 },
          { id: 2, name: "Half Owned", gameCount: 2, ownedCount: 1 },
        ]}
        isLoading={false}
        getCount={(entry) => entry.gameCount}
        getHref={() => "/"}
        statusFilter={{
          label: "Ownership",
          choices: [
            {
              value: "complete",
              label: "Complete",
              matches: (entry) => entry.ownedCount >= entry.gameCount,
            },
            {
              value: "missing",
              label: "Missing games",
              matches: (entry) => entry.ownedCount < entry.gameCount,
            },
          ],
        }}
      />
    );

    await pick(user, "View", "Table");
    expect(tableRows()).toEqual(["All Owned", "Half Owned"]);

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Missing games" })
    );
    await closeFilters(user);

    expect(tableRows()).toEqual(["Half Owned"]);
    expect(screen.getByText("Missing games")).toBeInTheDocument();
  });
});
