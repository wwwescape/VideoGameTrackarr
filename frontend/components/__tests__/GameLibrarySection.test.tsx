import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryItem, PlatformResponse } from "../../api/types";
import { createVgtTheme } from "../../theme/createVgtTheme";
import GameLibrarySection from "../GameLibrarySection";

const updateItem = vi.fn(async () => ({}));
const deleteItem = vi.fn(async () => undefined);
const undoToast = vi.fn();

const mutation = (mutateAsync = vi.fn()) => ({ mutateAsync, isPending: false });
vi.mock("../../hooks/useLibrary", () => ({
  useAddLibraryItem: () => mutation(),
  useUpdateLibraryItem: () => mutation(updateItem),
  useDeleteLibraryItem: () => mutation(deleteItem),
  useAddRom: () => mutation(),
  useReplaceRom: () => mutation(),
  useUpdateRomLabel: () => mutation(),
  useDeleteRom: () => mutation(),
}));
vi.mock("../UndoToast", () => ({ showUndoToast: (...args: unknown[]) => undoToast(...args) }));
// The dialog has its own tests; here it only needs to say it opened, and for what.
vi.mock("../LibraryItemDialog", () => ({
  default: ({ open, title }: { open: boolean; title: string }) => (open ? <div role="dialog">{title}</div> : null),
}));

const item = (overrides: Partial<LibraryItem>): LibraryItem =>
  ({
    id: 1,
    gameId: 7,
    platformId: 1,
    platformName: "PlayStation 5",
    platformSlug: "ps5",
    regionId: null,
    regionName: null,
    status: "owned",
    format: "physical",
    digitalStorefront: null,
    edition: null,
    steelbook: false,
    isOnSale: false,
    roms: [],
    ...overrides,
  }) as LibraryItem;

const PLATFORMS = [{ id: 1, name: "PlayStation 5", abbreviation: "PS5" }, { id: 2, name: "PC (Microsoft Windows)", abbreviation: "PC" }] as PlatformResponse[];
const ITEMS = [
  item({ id: 2, status: "wishlist", platformId: 2, platformName: "PC (Microsoft Windows)", format: "digital", digitalStorefront: "Steam" }),
  item({ id: 1, edition: "Deluxe", steelbook: true }),
];

function renderSection(items = ITEMS) {
  render(
    <ThemeProvider theme={createVgtTheme("dark", "normal", "#7c4dff")}>
      <MemoryRouter>
        <GameLibrarySection gameId={7} libraryItems={items} platforms={PLATFORMS} regions={[]} />
      </MemoryRouter>
    </ThemeProvider>
  );
  return userEvent.setup();
}

const row = (name: string) => screen.getByRole("button", { name });

describe("GameLibrarySection", () => {
  beforeEach(() => {
    updateItem.mockClear();
    undoToast.mockClear();
  });

  it("lists each copy as a row, owned first, with its details", () => {
    renderSection();

    const rows = screen.getAllByRole("button", { name: /PlayStation 5|PC \(Microsoft Windows\)/ });
    expect(rows.map((r) => r.getAttribute("aria-label"))).toEqual(["PlayStation 5", "PC (Microsoft Windows)"]);
    expect(within(row("PlayStation 5")).getByText("Deluxe")).toBeInTheDocument();
    expect(within(row("PlayStation 5")).getByText("Physical · Steelbook")).toBeInTheDocument();
    expect(within(row("PlayStation 5")).getByText("PS5")).toBeInTheDocument();
    expect(within(row("PlayStation 5")).getByText("Owned")).toBeInTheDocument();
    expect(within(row("PC (Microsoft Windows)")).getByText("Digital: Steam")).toBeInTheDocument();
    expect(within(row("PC (Microsoft Windows)")).getByText("Wishlist")).toBeInTheDocument();
  });

  it("shows Steelbook only for a physical copy, and an edition line only when there is one", () => {
    renderSection([item({ id: 3, format: "digital", digitalStorefront: "PlayStation Store", steelbook: true })]);

    const copy = row("PlayStation 5");
    expect(within(copy).getByText("Digital: PlayStation Store")).toBeInTheDocument();
    expect(copy).not.toHaveTextContent("Steelbook");
    expect(copy.textContent).not.toContain("Deluxe");
  });

  it("spells out a wishlisted copy's sale on its own line", () => {
    renderSection([
      item({ id: 4, status: "wishlist", isOnSale: true, salePriceAmount: 19.99, salePriceCurrency: "USD", saleShopName: "Steam", saleCut: 60 }),
    ]);

    expect(within(row("PlayStation 5")).getByText("On sale: $19.99 at Steam (-60%)")).toBeInTheDocument();
  });

  it("says so when the game isn't in the library", () => {
    renderSection([]);

    expect(screen.getByText("Not in your library yet.")).toBeInTheDocument();
  });

  it("opens a copy's dialog from its row", async () => {
    const user = renderSection();

    await user.click(row("PlayStation 5"));

    expect(screen.getByRole("dialog")).toHaveTextContent("Update game in your collection");
  });

  it("adds a copy to the wishlist from Add copy", async () => {
    const user = renderSection();

    await user.click(screen.getByRole("button", { name: "Add copy" }));
    await user.click(screen.getByRole("menuitem", { name: "To your wishlist" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("Add game to your wishlist");
  });

  it("moves a copy to the wishlist without opening it", async () => {
    const user = renderSection();

    await user.click(within(row("PlayStation 5")).getByRole("button", { name: "Move to wishlist" }));

    expect(updateItem).toHaveBeenCalledWith({ itemId: 1, input: { status: "wishlist" } });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("removes a copy with an undo", async () => {
    const user = renderSection();

    await user.click(within(row("PC (Microsoft Windows)")).getByRole("button", { name: "Remove" }));

    expect(undoToast).toHaveBeenCalledWith("Entry removed from your wishlist", expect.any(Function), 5000);
    expect(screen.queryByRole("button", { name: "PC (Microsoft Windows)" })).toBeNull();
  });
});
