import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSetScreensaverExcluded } from "../useScreensaver";

// A plain function rather than a vi.fn: vitest follows every promise a mock returns, and that
// copy of a rejected one would be reported as unhandled.
let saveImpl: (gameId: number, excluded: boolean) => Promise<boolean> = async (_id, excluded) => excluded;
const calls: Array<[number, boolean]> = [];
vi.mock("../../api/screensaver", () => ({
  getScreensaverSample: vi.fn(),
  setScreensaverExcluded: (gameId: number, excluded: boolean) => {
    calls.push([gameId, excluded]);
    return saveImpl(gameId, excluded);
  },
  setScreensaverExcludedBulk: vi.fn(),
}));

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  // The game's page (keyed by its address) and an unrelated list, which must be left alone.
  queryClient.setQueryData(["games", "astro-bot"], { id: 5, name: "Astro Bot", screensaverExcluded: false });
  queryClient.setQueryData(["games", { search: "a" }], [{ id: 5, screensaverExcluded: false }]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useSetScreensaverExcluded(5), { wrapper });
  return { queryClient, result };
}

const excludedOnPage = (queryClient: QueryClient) =>
  queryClient.getQueryData<{ screensaverExcluded: boolean }>(["games", "astro-bot"])?.screensaverExcluded;

describe("useSetScreensaverExcluded", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("shows the change on the game's page at once", async () => {
    let finish: (value: boolean) => void = () => {};
    saveImpl = () => new Promise<boolean>((resolve) => (finish = resolve));
    const { queryClient, result } = setup();

    act(() => result.current.mutate(true));
    await waitFor(() => expect(excludedOnPage(queryClient)).toBe(true));
    // Lists aren't patched by hand; they're refetched once it's saved.
    expect(queryClient.getQueryData(["games", { search: "a" }])).toEqual([{ id: 5, screensaverExcluded: false }]);
    expect(calls).toEqual([[5, true]]);

    await act(async () => finish(true));
  });

  it("puts it back when saving fails", async () => {
    saveImpl = () => Promise.reject(new Error("offline"));
    const { queryClient, result } = setup();

    act(() => result.current.mutate(true));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(excludedOnPage(queryClient)).toBe(false);
  });
});
