import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IsolatedPlayerPage from "../IsolatedPlayerPage";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

const createPlaySession = vi.fn();
vi.mock("../../api/library", () => ({
  createPlaySession: (...args: unknown[]) => createPlaySession(...args),
  listSaveStates: vi.fn().mockResolvedValue([]),
  deleteSaveState: vi.fn(),
  createSaveState: vi.fn(),
  getInGameSave: vi.fn(),
  getSaveStateData: vi.fn(),
  putInGameSave: vi.fn(),
  saveStateScreenshotPath: vi.fn(),
}));

function renderAt(search: string, isolated = true) {
  window.history.replaceState(null, "", `/player-isolated.html${search}`);
  Object.defineProperty(window, "crossOriginIsolated", { configurable: true, value: isolated });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <IsolatedPlayerPage />
    </QueryClientProvider>
  );
}

describe("IsolatedPlayerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, "crossOriginIsolated", { configurable: true, value: false });
    window.history.replaceState(null, "", "/");
  });

  it("starts a session for the ROM and plays it with threads", async () => {
    createPlaySession.mockResolvedValue({
      romUrl: "/api/roms/31/content/tok/doom.zip",
      core: "dosbox_pure",
      gameName: "vgt-rom-31",
      isolated: true,
      biosFiles: [],
      coreOptions: {},
    });
    renderAt("?rom=31&resume=4&title=Doom%20(DOS)");

    const iframe = await screen.findByTitle("Doom (DOS)");
    expect(createPlaySession).toHaveBeenCalledWith(31);
    const src = new URL(iframe.getAttribute("src") as string, "http://localhost");
    expect(src.searchParams.get("core")).toBe("dosbox_pure");
    expect(src.searchParams.get("threads")).toBe("1");
    expect(document.title).toBe("Doom (DOS) · VideoGameTrackarr");
  });

  it("closes the tab once the player has flushed its saves", async () => {
    const user = userEvent.setup();
    const close = vi.spyOn(window, "close").mockImplementation(() => undefined);
    createPlaySession.mockResolvedValue({
      romUrl: "/api/roms/31/content/tok/doom.zip",
      core: "dosbox_pure",
      gameName: "vgt-rom-31",
      isolated: true,
      biosFiles: [],
      coreOptions: {},
    });
    renderAt("?rom=31&title=Doom");

    const iframe = (await screen.findByTitle("Doom")) as HTMLIFrameElement;
    await user.click(screen.getByRole("button", { name: "Close player" }));
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "vgt:flushed" },
        origin: window.location.origin,
        source: iframe.contentWindow,
      })
    );

    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(await screen.findByText("Your progress is saved. You can close this tab.")).toBeInTheDocument();
    close.mockRestore();
  });

  it("explains a browser that isn't cross-origin isolated instead of starting", () => {
    renderAt("?rom=31&title=Doom", false);

    expect(screen.getByText(/couldn't set up the isolated page/)).toBeInTheDocument();
    expect(createPlaySession).not.toHaveBeenCalled();
  });

  it("rejects a link without a ROM", () => {
    renderAt("?title=Doom");

    expect(screen.getByText(/This play link is invalid/)).toBeInTheDocument();
    expect(createPlaySession).not.toHaveBeenCalled();
  });
});
