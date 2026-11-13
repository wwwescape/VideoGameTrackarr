import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScreensaverGame, ScreensaverSample } from "../../api/types";
import Screensaver, { IDLE_RESUME_MS } from "../Screensaver";

const INTERVAL = 5;
let sample: { data?: ScreensaverSample; isError: boolean };
const refetch = vi.fn();
const fetchSample = vi.fn<() => Promise<ScreensaverSample>>();

vi.mock("../../hooks/useScreensaver", () => ({
  screensaverSampleOptions: { queryKey: ["screensaver"], queryFn: () => fetchSample() },
  useScreensaverSample: () => ({ ...sample, refetch, isFetching: false }),
  useScreensaverInterval: () => ({ seconds: INTERVAL }),
}));
vi.mock("../../hooks/useKeepAwake", () => ({ useKeepAwake: () => false }));

const game = (id: number, name: string): ScreensaverGame => ({
  id,
  uuid: `uuid-${id}`,
  slug: name.toLowerCase().replace(/ /g, "-"),
  name,
  coverUrl: `https://images.igdb.com/igdb/image/upload/t_720p/co${id}.jpg`,
});
const GAMES = [game(1, "Astro Bot"), game(2, "Balatro"), game(3, "Celeste")];

let reducedMotion = true;

beforeAll(() => {
  // jsdom has neither PointerEvent nor image loading.
  if (!("PointerEvent" in window)) {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    Object.defineProperty(window, "PointerEvent", { value: PointerEventPolyfill, configurable: true });
  }
  class LoadingImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      window.setTimeout(() => this.onload?.(), 0);
    }
  }
  vi.stubGlobal("Image", LoadingImage);
});

beforeEach(() => {
  vi.useFakeTimers();
  reducedMotion = true;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
  sample = { data: { games: GAMES, total: GAMES.length }, isError: false };
  refetch.mockReset();
  fetchSample.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

function renderScreensaver() {
  const router = createMemoryRouter(
    [
      { path: "/games", element: <Screensaver /> },
      { path: "/start", element: <div>Start page</div> },
      { path: "/game/:identifier", element: <div>Game page</div> },
    ],
    { initialEntries: ["/start", "/games"], initialIndex: 1 }
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  return { router, queryClient };
}

const shown = () => screen.getByRole("img", { name: /, cover \d+ of \d+$/ }).getAttribute("alt");
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const stage = () => screen.getByTestId("screensaver-stage");

function press(x: number, y = 300, pointerId = 1) {
  fireEvent.pointerDown(stage(), { clientX: x, clientY: y, pointerId, button: 0 });
}
function moveTo(x: number, y = 300, pointerId = 1) {
  fireEvent.pointerMove(stage(), { clientX: x, clientY: y, pointerId });
}
function release(x: number, y = 300, pointerId = 1) {
  fireEvent.pointerUp(stage(), { clientX: x, clientY: y, pointerId });
}

describe("Screensaver", () => {
  it("shows the first cover full screen, as a labelled dialog", () => {
    renderScreensaver();
    expect(screen.getByRole("dialog", { name: "Screensaver" })).toBeInTheDocument();
    expect(shown()).toBe("Astro Bot, cover 1 of 3");
  });

  it("moves on by itself at the chosen interval", () => {
    renderScreensaver();
    advance(INTERVAL * 1000 - 10);
    expect(shown()).toBe("Astro Bot, cover 1 of 3");
    advance(20);
    expect(shown()).toBe("Balatro, cover 2 of 3");
    advance(INTERVAL * 1000);
    expect(shown()).toBe("Celeste, cover 3 of 3");
  });

  it("arrow keys move one cover and pause auto mode until idle", () => {
    renderScreensaver();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(shown()).toBe("Balatro, cover 2 of 3");

    advance(IDLE_RESUME_MS - 10);
    expect(shown()).toBe("Balatro, cover 2 of 3");

    // Auto mode's timer starts once the resume has rendered.
    advance(10);
    advance(INTERVAL * 1000);
    expect(shown()).toBe("Celeste, cover 3 of 3");

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(shown()).toBe("Balatro, cover 2 of 3");
  });

  it("a swipe moves one cover each way and pauses", () => {
    renderScreensaver();
    press(600);
    moveTo(300);
    release(300);
    expect(shown()).toBe("Balatro, cover 2 of 3");

    advance(200);
    press(200);
    moveTo(700);
    release(700);
    expect(shown()).toBe("Astro Bot, cover 1 of 3");

    advance(IDLE_RESUME_MS - 300);
    expect(shown()).toBe("Astro Bot, cover 1 of 3");
  });

  it("a short drag springs back", () => {
    renderScreensaver();
    advance(1000);
    press(500);
    moveTo(480);
    // Slowly, or it's a flick.
    advance(300);
    release(480);
    expect(shown()).toBe("Astro Bot, cover 1 of 3");
  });

  it("slides with an animation without reduced motion", () => {
    reducedMotion = false;
    renderScreensaver();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const track = screen.getByTestId("screensaver-track");
    expect(getComputedStyle(track).transform).toBe("translateX(-100%)");
    expect(shown()).toBe("Astro Bot, cover 1 of 3");

    fireEvent.transitionEnd(track);
    expect(shown()).toBe("Balatro, cover 2 of 3");
    expect(getComputedStyle(track).transform).toBe("translateX(0px)");
  });

  it("finishes a slide even if the browser never reports its end", () => {
    reducedMotion = false;
    renderScreensaver();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(shown()).toBe("Astro Bot, cover 1 of 3");

    advance(800);
    expect(shown()).toBe("Balatro, cover 2 of 3");
    expect(getComputedStyle(screen.getByTestId("screensaver-track")).transform).toBe("translateX(0px)");
  });

  it("a tap asks before opening the game, and Go replaces the screensaver's entry", () => {
    const { router } = renderScreensaver();
    press(400);
    release(402);

    expect(screen.getByRole("dialog", { name: "Open game?" })).toBeInTheDocument();
    expect(screen.getByText("Go to Astro Bot's page?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Go to game" }));

    expect(router.state.location.pathname).toBe("/game/astro-bot");
    expect(router.state.historyAction).toBe("REPLACE");
    // The page can scroll again once both the dialog and the screensaver are gone.
    advance(500);
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.overflow).toBe("");
  });

  it("locks the page behind while open", () => {
    renderScreensaver();
    expect(document.documentElement.style.overflow).toBe("hidden");
  });

  it("a long press is not a tap", () => {
    renderScreensaver();
    press(400);
    advance(800);
    release(400);
    expect(screen.queryByRole("dialog", { name: "Open game?" })).not.toBeInTheDocument();
  });

  it("Cancel keeps the screensaver and resumes after idle", () => {
    renderScreensaver();
    press(400);
    release(400);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    // Once the confirm has finished closing.
    advance(500);
    expect(screen.getByRole("dialog", { name: "Screensaver" })).toBeInTheDocument();
    expect(shown()).toBe("Astro Bot, cover 1 of 3");

    advance(IDLE_RESUME_MS);
    advance(INTERVAL * 1000 + 10);
    expect(shown()).toBe("Balatro, cover 2 of 3");
  });

  it("Escape and the close button go back to the page it opened on", () => {
    const { router } = renderScreensaver();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(router.state.location.pathname).toBe("/start");
  });

  it("the close button goes back too", () => {
    const { router } = renderScreensaver();
    fireEvent.click(screen.getByRole("button", { name: "Close screensaver" }));
    expect(router.state.location.pathname).toBe("/start");
  });

  it("reshuffles locally when it already has every cover", async () => {
    renderScreensaver();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(shown()).toBe("Celeste, cover 3 of 3");

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(fetchSample).not.toHaveBeenCalled();
    expect(shown()).toMatch(/^(Astro Bot|Balatro), cover 1 of 3$/);
  });

  it("asks for a new sample when the library is larger than one", async () => {
    sample = { data: { games: GAMES, total: 1200 }, isError: false };
    fetchSample.mockResolvedValue({ games: [game(3, "Celeste"), game(9, "Hades")], total: 1200 });
    renderScreensaver();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await act(async () => {});

    expect(fetchSample).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    // Celeste was on screen, so it moves to the end of the new sample.
    expect(shown()).toBe("Hades, cover 1 of 2");
  });

  it("explains when there's nothing to show", () => {
    sample = { data: { games: [], total: 0 }, isError: false };
    const { router } = renderScreensaver();
    expect(screen.getByText(/No covers to show yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(router.state.location.pathname).toBe("/start");
  });

  it("offers a retry when the covers don't load", () => {
    sample = { isError: true };
    renderScreensaver();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows VGT's badge top left, letting taps through to the cover", () => {
    renderScreensaver();
    const brand = screen.getByTestId("screensaver-brand");
    expect(brand).toHaveTextContent("VideoGameTrackarr");
    expect(brand.querySelector("img")).toHaveAttribute("src", "/icon-master.svg");
    const style = getComputedStyle(brand);
    expect(style.pointerEvents).toBe("none");
    expect(style.left).toContain("12px");
    expect(style.right).toBe("auto");
    // The close button keeps the top right to itself.
    expect(brand).not.toContainElement(screen.getByRole("button", { name: "Close screensaver" }));
  });

  it("asks IGDB for full-screen sized covers", () => {
    renderScreensaver();
    expect(screen.getByRole("img", { name: /cover 1 of 3/ })).toHaveAttribute(
      "src",
      "https://images.igdb.com/igdb/image/upload/t_1080p/co1.jpg"
    );
  });
});
