import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
  return rtlRender(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

function rom(overrides: Partial<RomFileSummary>): RomFileSummary {
  return {
    id: 1,
    label: null,
    originalFilename: "game.nes",
    sizeBytes: 2048,
    extension: "nes",
    isArchive: false,
    playable: true,
    core: "fceumm",
    unplayableReason: null,
    missingBiosSystem: null,
    isolated: false,
    saveStateCount: 0,
    hasInGameSave: false,
    ...overrides,
  };
}

function item(
  id: number,
  platformName: string,
  romSummary: RomFileSummary | RomFileSummary[] | null,
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
    roms: romSummary == null ? [] : Array.isArray(romSummary) ? romSummary : [romSummary],
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
      isolated: false,
      biosFiles: [],
      coreOptions: {},
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
      isolated: false,
      biosFiles: [],
      coreOptions: {},
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

  it("lists every ROM on a copy by its label, and plays the chosen one", async () => {
    const user = userEvent.setup();
    createPlaySession.mockResolvedValue({
      romUrl: "/api/roms/22/content/tok/j.nes",
      core: "fceumm",
      gameName: "vgt-rom-22",
      isolated: false,
      biosFiles: [],
      coreOptions: {},
    });
    const copy = item(1, "Nintendo Entertainment System", [
      rom({ id: 21, label: "USA", originalFilename: "u.nes" }),
      rom({ id: 22, label: "Japan", originalFilename: "j.nes" }),
    ]);
    render(<PlayGameDialog open gameName="Mario" libraryItems={[copy]} onClose={vi.fn()} />);

    expect(screen.getByText("USA")).toBeInTheDocument();
    expect(screen.getByText(/^u\.nes · 2\.0 KB/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Play Japan" }));

    expect(createPlaySession).toHaveBeenCalledWith(22);
    expect(await screen.findByTitle("Mario (Nintendo Entertainment System) — Japan")).toBeInTheDocument();
  });

  it("explains a missing BIOS and links to the BIOS settings", () => {
    const copy = item(
      1,
      "Atari Lynx",
      rom({ playable: false, core: "handy", unplayableReason: "missing_bios", missingBiosSystem: "lynx" })
    );
    render(<PlayGameDialog open gameName="Mario" libraryItems={[copy]} onClose={vi.fn()} />);

    expect(screen.getByText(/Needs a BIOS file for this system/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add it in Settings → Emulation" })).toHaveAttribute(
      "href",
      "/settings/emulation"
    );
  });

  it("opens DOS/PSP ROMs in their own tab instead of the in-page player", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const copy = item(1, "DOS", rom({ id: 31, originalFilename: "doom.zip", core: "dosbox_pure", isolated: true }));
    render(<PlayGameDialog open gameName="Doom" libraryItems={[copy]} onClose={vi.fn()} />);

    expect(screen.getByText(/Opens in a new tab/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Play doom.zip" }));

    expect(createPlaySession).not.toHaveBeenCalled();
    const [url, target] = open.mock.calls[0] as [string, string];
    const parsed = new URL(url, "http://localhost");
    expect(parsed.pathname).toBe("/player-isolated.html");
    expect(parsed.searchParams.get("rom")).toBe("31");
    expect(parsed.searchParams.get("title")).toBe("Doom (DOS)");
    expect(target).toBe("_blank");
    expect(screen.getByText("The game opened in a new tab.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Didn't open? Open it here." })).toHaveAttribute("href", url);
    open.mockRestore();
  });
});
