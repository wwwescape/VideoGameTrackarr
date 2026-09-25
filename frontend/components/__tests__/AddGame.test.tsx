import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { GameSummary, IgdbSearchResult } from "../../api/types";
import AddGame from "../AddGame";

vi.mock("react-toastify", () => ({
  toast: { info: vi.fn(), error: vi.fn() },
}));

// AddGame's "manual" tab pulls in ManualGameForm -> theme/LanguageProvider -> i18n/index.ts,
// which calls readStoredLanguage() as a top-level side effect at import time — this test
// environment's localStorage isn't available that early, so it throws before any test can
// even run. test/setup.ts already initializes i18next directly with the real English
// bundle, so i18n/index.ts's own (re-)initialization isn't needed here anyway.
vi.mock("../../utils/language", () => ({
  readStoredLanguage: () => "en",
  DEFAULT_LANGUAGE: "en",
}));

// No debounce in tests — AddGame gates its whole results view on the debounced keyword
// actually reaching 3+ chars, so a real 1000ms delay would just make every test slower for
// no benefit here.
vi.mock("../../hooks/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}));

// jsdom doesn't implement ResizeObserver — VirtualGameGrid.tsx (the search results grid)
// needs one to mount at all.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const searchResults: IgdbSearchResult[] = [
  { igdbId: 1, name: "Not Yet Added", category: "main_game" } as IgdbSearchResult,
  { igdbId: 2, name: "Already Added", category: "main_game" } as IgdbSearchResult,
];

const localGames: Partial<GameSummary>[] = [{ id: 99, igdbId: 2, name: "Already Added" }];

vi.mock("../../hooks/useIgdbSearch", () => ({
  useIgdbSearch: () => ({ data: searchResults, isFetching: false, error: null }),
}));

vi.mock("../../hooks/useGames", () => ({
  useGames: () => ({ data: localGames }),
  useImportGame: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBulkImportStatus: () => ({ data: { status: "idle", result: null } }),
  useAcknowledgeBulkImportStatus: () => ({ mutate: vi.fn() }),
  useStartBulkImport: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// BulkAddDialog is always mounted (its own `open` prop just controls MUI Dialog's internal
// rendering) — its hooks still run every render, so they need mocking here too even though
// these tests never actually open it.
vi.mock("../../hooks/usePlatforms", () => ({
  usePlatforms: () => ({ data: [] }),
}));
vi.mock("../../hooks/useTags", () => ({
  useTags: () => ({ data: [] }),
  useCreateTag: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

async function renderWithSearch() {
  const user = userEvent.setup();
  render(<AddGame />, { wrapper: MemoryRouter });
  await user.type(screen.getByLabelText("Search games on IGDB"), "test");
  await screen.findByText("Not Yet Added");
  return user;
}

describe("AddGame bulk selection", () => {
  it("replaces the search bar with a selection bar when Select games is clicked", async () => {
    const user = await renderWithSearch();

    await user.click(screen.getByRole("button", { name: "Select games" }));

    expect(screen.queryByLabelText("Search games on IGDB")).not.toBeInTheDocument();
    expect(screen.getByText("0 selected")).toBeInTheDocument();
  });

  it("only offers a checkbox for the not-yet-added result", async () => {
    const user = await renderWithSearch();
    await user.click(screen.getByRole("button", { name: "Select games" }));

    expect(screen.getByRole("checkbox", { name: /Not Yet Added/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Already Added/ })).not.toBeInTheDocument();
  });

  it("Select all only selects the addable result, and toggles it back off", async () => {
    const user = await renderWithSearch();
    await user.click(screen.getByRole("button", { name: "Select games" }));

    await user.click(screen.getByRole("button", { name: "Select all visible games" }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Not Yet Added/ })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Deselect all visible games" }));
    expect(screen.getByText("0 selected")).toBeInTheDocument();
  });

  it("enables Add Selected once a game is checked, and opens the bulk-add dialog on click", async () => {
    const user = await renderWithSearch();
    await user.click(screen.getByRole("button", { name: "Select games" }));

    expect(screen.getByRole("button", { name: "Add Selected" })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: /Not Yet Added/ }));
    expect(screen.getByRole("button", { name: "Add Selected" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Add Selected" }));
    expect(await screen.findByText("1 game will be added.")).toBeInTheDocument();
  });

  it("clears the selection on exit", async () => {
    const user = await renderWithSearch();
    await user.click(screen.getByRole("button", { name: "Select games" }));
    await user.click(screen.getByRole("checkbox", { name: /Not Yet Added/ }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Exit selection mode" }));
    await user.click(screen.getByRole("button", { name: "Select games" }));

    expect(screen.getByText("0 selected")).toBeInTheDocument();
  });
});
