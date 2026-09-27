import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryItem, RomFileSummary } from "../../api/types";
import PlayGameDialog from "../PlayGameDialog";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

const createPlaySession = vi.fn();
const listSaveStates = vi.fn();
vi.mock("../../api/library", () => ({
  createPlaySession: (...args: unknown[]) => createPlaySession(...args),
  listSaveStates: (...args: unknown[]) => listSaveStates(...args),
  deleteSaveState: vi.fn(),
  createSaveState: vi.fn(),
  getInGameSave: vi.fn(),
  getSaveStateData: vi.fn(),
  putInGameSave: vi.fn(),
  saveStateScreenshotPath: (romId: number, stateId: number) =>
    `/api/roms/${romId}/states/${stateId}/screenshot`,
}));

function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function rom(overrides: Partial<RomFileSummary>): RomFileSummary {
  return {
    id: 1,
    originalFilename: "game.nes",
    sizeBytes: 2048,
    extension: "nes",
    isArchive: false,
    playable: true,
    core: "fceumm",
    unplayableReason: null,
    saveStateCount: 0,
    hasInGameSave: false,
    ...overrides,
  };
}

function item(
  id: number,
  platformName: string,
  romSummary: RomFileSummary | null,
  status: LibraryItem["status"] = "owned"
) {
  return {
    id,
    gameId: 1,
    platformId: id,
    platformName,
    platformSlug: null,
    regionId: null,
    regionName: null,
    status,
    format: "rom",
    digitalStorefront: null,
    ratingBoard: null,
    edition: null,
    price: null,
    targetPrice: null,
    trackForSales: false,
    acquiredAt: null,
    notes: null,
    steelbook: false,
    isOnSale: false,
    salePriceAmount: null,
    salePriceCurrency: null,
    saleShopName: null,
    saleCut: null,
    rom: romSummary,
  } satisfies LibraryItem;
}

const items: LibraryItem[] = [
  item(1, "Nintendo Entertainment System", rom({ id: 11, originalFilename: "Mario (USA).nes" })),
  item(
    2,
    "Game Boy Advance",
    rom({ id: 12, originalFilename: "Mario.zip", extension: "gba", isArchive: true, core: "mgba" })
  ),
  item(
    3,
    "Super Nintendo Entertainment System",
    rom({
      id: 13,
      originalFilename: "Mario.sfc",
      extension: "sfc",
      playable: false,
      core: null,
      unplayableReason: "unsupported_platform",
    })
  ),
  item(4, "Nintendo Entertainment System", null),
];

describe("PlayGameDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists uploaded ROMs grouped by platform, alphabetically", () => {
    render(<PlayGameDialog open gameName="Mario" libraryItems={items} onClose={vi.fn()} />);

    const headers = screen.getAllByText(/Nintendo Entertainment System|Game Boy Advance/, {
      selector: "li",
    });
    expect(headers.map((h) => h.textContent)).toEqual([
      "Game Boy Advance",
      "Nintendo Entertainment System",
      "Super Nintendo Entertainment System",
    ]);
    expect(screen.getByText("Mario (USA).nes")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB · ZIP (GBA)")).toBeInTheDocument();
  });

  it("disables Play for an unplayable ROM and explains why", () => {
    render(<PlayGameDialog open gameName="Mario" libraryItems={items} onClose={vi.fn()} />);

    const row = screen.getByText("Mario.sfc").closest("li") as HTMLElement;
    expect(within(row).getByRole("button", { name: "Play" })).toBeDisabled();
    expect(
      within(row).getByText(/This platform can't be played in the browser yet/)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play Mario (USA).nes" })).toBeEnabled();
  });

  it("ignores wishlist copies", () => {
    render(
      <PlayGameDialog
        open
        gameName="Mario"
        libraryItems={[
          item(
            9,
            "Nintendo Entertainment System",
            rom({ originalFilename: "wish.nes" }),
            "wishlist"
          ),
        ]}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText("wish.nes")).not.toBeInTheDocument();
    expect(screen.getByText("No ROMs uploaded for this game.")).toBeInTheDocument();
  });

  it("starts a play session and opens the player iframe", async () => {
    const user = userEvent.setup();
    createPlaySession.mockResolvedValue({
      romUrl: "/api/roms/11/content/tok/Mario.nes",
      core: "fceumm",
      gameName: "vgt-rom-11",
    });
    render(<PlayGameDialog open gameName="Mario" libraryItems={items} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Play Mario (USA).nes" }));

    expect(createPlaySession).toHaveBeenCalledWith(11);
    const iframe = await screen.findByTitle("Mario (Nintendo Entertainment System)");
    const src = new URL(iframe.getAttribute("src") as string, "http://localhost");
    expect(src.pathname).toBe("/emulatorjs/player.html");
    expect(src.searchParams.get("core")).toBe("fceumm");
    expect(src.searchParams.get("name")).toBe("vgt-rom-11");
    expect(src.searchParams.get("rom")).toMatch(/\/api\/roms\/11\/content\/tok\/Mario\.nes$/);

    await user.click(screen.getByRole("button", { name: "Close player" }));
    // Closing waits for the player to confirm its final in-game save flush.
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "vgt:flushed" },
        origin: window.location.origin,
        source: (iframe as HTMLIFrameElement).contentWindow,
      })
    );
    await waitFor(() =>
      expect(screen.queryByTitle("Mario (Nintendo Entertainment System)")).not.toBeInTheDocument()
    );
  });

  it("offers Resume only for ROMs with save states, and resumes from the picked state", async () => {
    const user = userEvent.setup();
    listSaveStates.mockResolvedValue([
      { id: 5, createdAt: "2026-09-27T10:00:00Z", sizeBytes: 2048, hasScreenshot: false },
    ]);
    createPlaySession.mockResolvedValue({
      romUrl: "/api/roms/11/content/tok/Mario.nes",
      core: "fceumm",
      gameName: "vgt-rom-11",
    });
    const withStates = [
      item(
        1,
        "Nintendo Entertainment System",
        rom({ id: 11, originalFilename: "Mario (USA).nes", saveStateCount: 1, hasInGameSave: true })
      ),
      item(
        2,
        "Game Boy Advance",
        rom({ id: 12, originalFilename: "Mario.gba", extension: "gba", core: "mgba" })
      ),
    ];
    render(<PlayGameDialog open gameName="Mario" libraryItems={withStates} onClose={vi.fn()} />);

    expect(screen.getByText(/1 save state · In-game save/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Resume Mario.gba from a save state" })
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Resume Mario (USA).nes from a save state" })
    );

    expect(listSaveStates).toHaveBeenCalledWith(11);
    await user.click(await screen.findByRole("button", { name: /^Resume .*2026/ }));

    expect(createPlaySession).toHaveBeenCalledWith(11);
    expect(await screen.findByTitle("Mario (Nintendo Entertainment System)")).toBeInTheDocument();
  });
});
