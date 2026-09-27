import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EmulatorPlayerDialog from "../EmulatorPlayerDialog";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

const api = {
  createSaveState: vi.fn(),
  getInGameSave: vi.fn(),
  getSaveStateData: vi.fn(),
  putInGameSave: vi.fn(),
  listSaveStates: vi.fn(),
};
vi.mock("../../api/library", () => ({
  createSaveState: (...args: unknown[]) => api.createSaveState(...args),
  getInGameSave: (...args: unknown[]) => api.getInGameSave(...args),
  getSaveStateData: (...args: unknown[]) => api.getSaveStateData(...args),
  putInGameSave: (...args: unknown[]) => api.putInGameSave(...args),
  listSaveStates: (...args: unknown[]) => api.listSaveStates(...args),
  deleteSaveState: vi.fn(),
  saveStateScreenshotPath: () => "/x",
}));

const session = {
  romUrl: "/api/roms/7/content/tok/game.nes",
  core: "fceumm",
  gameName: "vgt-rom-7",
  isolated: false,
  biosFiles: [],
  coreOptions: {},
};

function renderPlayer(props: Partial<Parameters<typeof EmulatorPlayerDialog>[0]> = {}) {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EmulatorPlayerDialog
        open
        title="Game"
        session={session}
        romId={7}
        onClose={onClose}
        {...props}
      />
    </QueryClientProvider>
  );
  const iframe = screen.getByTitle("Game") as HTMLIFrameElement;
  const posted: unknown[] = [];
  vi.spyOn(iframe.contentWindow as Window, "postMessage").mockImplementation((message: unknown) => {
    posted.push(message);
  });
  const fromPlayer = (
    data: object,
    source: Window | null = iframe.contentWindow,
    origin = window.location.origin
  ) =>
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data, origin, source }));
    });
  return { onClose, posted, fromPlayer };
}

describe("EmulatorPlayerDialog save bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getInGameSave.mockResolvedValue(null);
    api.putInGameSave.mockResolvedValue(undefined);
    api.createSaveState.mockResolvedValue({ id: 1 });
  });

  it("uploads a save state taken in the player and confirms it", async () => {
    const { posted, fromPlayer } = renderPlayer();
    const screenshot = new Blob(["png"], { type: "image/png" });

    fromPlayer({ type: "vgt:saveState", state: new Uint8Array([1, 2, 3]), screenshot });

    await waitFor(() =>
      expect(api.createSaveState).toHaveBeenCalledWith(7, expect.any(Blob), screenshot)
    );
    await waitFor(() =>
      expect(posted).toContainEqual({
        type: "vgt:message",
        text: "State saved to VideoGameTrackarr",
      })
    );
  });

  it("restores the in-game save and the resume state once the game starts", async () => {
    api.getInGameSave.mockResolvedValue(new Uint8Array([9, 9]).buffer);
    api.getSaveStateData.mockResolvedValue(new Uint8Array([4, 5]).buffer);
    const { posted, fromPlayer } = renderPlayer({ resumeStateId: 42 });

    fromPlayer({ type: "vgt:started" });

    await waitFor(() => expect(api.getSaveStateData).toHaveBeenCalledWith(7, 42));
    await waitFor(() =>
      expect(posted.map((m) => (m as { type: string }).type)).toEqual([
        "vgt:loadSram",
        "vgt:loadState",
      ])
    );
  });

  it("only uploads an in-game save when it actually changed", async () => {
    const { fromPlayer } = renderPlayer();

    fromPlayer({ type: "vgt:sram", bytes: new Uint8Array([1, 2]) });
    fromPlayer({ type: "vgt:sram", bytes: new Uint8Array([1, 2]) });
    fromPlayer({ type: "vgt:sram", bytes: new Uint8Array([1, 3]) });

    await waitFor(() => expect(api.putInGameSave).toHaveBeenCalledTimes(2));
  });

  it("ignores messages from another origin or another window", async () => {
    const { fromPlayer } = renderPlayer();

    fromPlayer({ type: "vgt:sram", bytes: new Uint8Array([1]) }, undefined, "https://evil.example");
    fromPlayer({ type: "vgt:sram", bytes: new Uint8Array([1]) }, window);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.putInGameSave).not.toHaveBeenCalled();
  });

  it("opens the save state picker when the in-game Load State button is used", async () => {
    api.listSaveStates.mockResolvedValue([]);
    const { fromPlayer } = renderPlayer();

    fromPlayer({ type: "vgt:loadStateRequest" });

    expect(await screen.findByText("Load a save state")).toBeInTheDocument();
    expect(await screen.findByText(/No save states yet/)).toBeInTheDocument();
  });

  it("waits for the final in-game save before closing", async () => {
    const user = userEvent.setup();
    const { onClose, posted, fromPlayer } = renderPlayer();

    await user.click(screen.getByRole("button", { name: "Close player" }));
    expect(posted).toContainEqual({ type: "vgt:flush" });
    expect(onClose).not.toHaveBeenCalled();

    fromPlayer({ type: "vgt:sram", bytes: new Uint8Array([7]) });
    fromPlayer({ type: "vgt:flushed" });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.putInGameSave).toHaveBeenCalledTimes(1);
  });

  it("hands BIOS files and core options to the player, and threads only when isolated", () => {
    renderPlayer({
      session: {
        ...session,
        biosFiles: [{ filename: "goldstar.bin", url: "/api/emulation/bios/content/1/tok/goldstar.bin" }],
        coreOptions: { opera_bios: "goldstar.bin" },
        isolated: true,
      },
    });

    const src = new URL(screen.getByTitle("Game").getAttribute("src") as string, "http://localhost");
    const bios = JSON.parse(src.searchParams.get("bios") as string) as { filename: string; url: string }[];
    expect(bios).toHaveLength(1);
    expect(bios[0].filename).toBe("goldstar.bin");
    expect(bios[0].url).toMatch(/\/api\/emulation\/bios\/content\/1\/tok\/goldstar\.bin$/);
    expect(JSON.parse(src.searchParams.get("options") as string)).toEqual({ opera_bios: "goldstar.bin" });
    // jsdom isn't cross-origin isolated, so no threaded cores even for an isolated session.
    expect(src.searchParams.has("threads")).toBe(false);
  });
});
