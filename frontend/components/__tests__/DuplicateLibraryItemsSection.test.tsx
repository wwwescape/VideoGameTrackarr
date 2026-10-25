import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { DuplicateLibraryItemGroup, LibraryItem } from "../../api/types";
import { createVgtTheme } from "../../theme/createVgtTheme";
import DuplicateLibraryItemsSection from "../DuplicateLibraryItemsSection";

const copy = (id: number, platformName: string | null): LibraryItem =>
  ({ id, gameId: 1, platformName, regionName: null, status: "owned", edition: null }) as LibraryItem;

const GROUPS: DuplicateLibraryItemGroup[] = [
  { gameId: 1, gameName: "Hades", gameSlug: "hades", gameUuid: "u1", items: [copy(10, "Switch"), copy(11, "Switch")] },
];

vi.mock("../../hooks/useInsights", () => ({ useDuplicateLibraryItems: () => ({ data: GROUPS }) }));
const undoToast = vi.fn();
vi.mock("../UndoToast", () => ({ showUndoToast: (...args: unknown[]) => undoToast(...args) }));
vi.mock("../VirtualList", () => ({
  default: <T,>({ items, getKey, renderItem }: { items: T[]; getKey: (item: T) => number; renderItem: (item: T) => ReactNode }) => (
    <div>
      {items.map((item) => (
        <div key={getKey(item)}>{renderItem(item)}</div>
      ))}
    </div>
  ),
}));

function renderSection() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
        <MemoryRouter>
          <DuplicateLibraryItemsSection />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
  return userEvent.setup();
}

describe("DuplicateLibraryItemsSection", () => {
  it("shows a section per game, linked to its library, with each copy", () => {
    renderSection();

    const section = screen.getByRole("heading", { name: "Hades" }).closest("section") as HTMLElement;
    expect(within(section).getByRole("link", { name: "Open game" })).toHaveAttribute("href", "/game/hades#library");
    expect(within(section).getAllByRole("button", { name: "Remove this entry" })).toHaveLength(2);
  });

  it("removes a copy with an undo, and the game leaves once it has no duplicate", async () => {
    const user = renderSection();

    await user.click(screen.getAllByRole("button", { name: "Remove this entry" })[0]);

    expect(undoToast).toHaveBeenCalledWith(expect.any(String), expect.any(Function), 5000);
    expect(screen.queryByRole("heading", { name: "Hades" })).toBeNull();
    expect(screen.getByText(/No duplicate/i)).toBeInTheDocument();
  });
});
