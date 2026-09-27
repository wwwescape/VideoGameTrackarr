import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tokenStorage } from "../../api/tokenStorage";
import { usePruneStaleIds, useSessionState } from "../useSessionState";

describe("useSessionState", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("starts from the initial value and remembers changes for the session", () => {
    const { result, unmount } = renderHook(() => useSessionState<number[]>("games.tagIds", []));
    expect(result.current[0]).toEqual([]);

    act(() => result.current[1]([3, 5]));
    expect(result.current[0]).toEqual([3, 5]);
    expect(window.sessionStorage.getItem("vgt.view.games.tagIds")).toBe("[3,5]");
    unmount();

    // Coming back to the page restores it.
    const { result: again } = renderHook(() => useSessionState<number[]>("games.tagIds", []));
    expect(again.current[0]).toEqual([3, 5]);
  });

  it("supports functional updates like useState", () => {
    const { result } = renderHook(() => useSessionState("games.searchKeyword", "ma"));
    act(() => result.current[1]((prev) => `${prev}rio`));
    expect(result.current[0]).toBe("mario");
  });

  it("switches to the new key's own value when the key changes", () => {
    window.sessionStorage.setItem(
      "vgt.view.collection.zelda.searchKeyword",
      JSON.stringify("link")
    );
    const { result, rerender } = renderHook(({ key }) => useSessionState(key, ""), {
      initialProps: { key: "collection.mario.searchKeyword" },
    });
    act(() => result.current[1]("bowser"));

    rerender({ key: "collection.zelda.searchKeyword" });
    expect(result.current[0]).toBe("link");
    // The previous page's value was never written under the new key.
    expect(window.sessionStorage.getItem("vgt.view.collection.mario.searchKeyword")).toBe(
      '"bowser"'
    );
    expect(window.sessionStorage.getItem("vgt.view.collection.zelda.searchKeyword")).toBe('"link"');
  });

  it("behaves like plain useState when storage is unavailable or holds bad data", () => {
    window.sessionStorage.setItem("vgt.view.hardware.status", "{not json");
    const { result } = renderHook(() => useSessionState("hardware.status", "all"));
    expect(result.current[0]).toBe("all");

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    act(() => result.current[1]("owned"));
    expect(result.current[0]).toBe("owned");
  });

  it("is cleared on logout", () => {
    // tokenStorage uses the bare `localStorage` global, which newer Node versions (26+)
    // shadow with their own unavailable one even under jsdom — stub just what clear() needs.
    vi.stubGlobal("localStorage", { removeItem: vi.fn() });
    window.sessionStorage.setItem("vgt.view.games.sort", JSON.stringify("name_desc"));
    window.sessionStorage.setItem("unrelated", "keep");

    tokenStorage.clear();

    expect(window.sessionStorage.getItem("vgt.view.games.sort")).toBeNull();
    expect(window.sessionStorage.getItem("unrelated")).toBe("keep");
  });
});

describe("usePruneStaleIds", () => {
  it("drops remembered ids that no longer exist, once the options have loaded", () => {
    const setIds = vi.fn();
    const { rerender } = renderHook(
      ({ ready }) => usePruneStaleIds([1, 2, 9], setIds, [{ id: 1 }, { id: 2 }], ready),
      { initialProps: { ready: false } }
    );
    expect(setIds).not.toHaveBeenCalled();

    rerender({ ready: true });
    expect(setIds).toHaveBeenCalledWith([1, 2]);
  });

  it("leaves valid ids alone", () => {
    const setIds = vi.fn();
    renderHook(() => usePruneStaleIds([1, 2], setIds, [{ id: 1 }, { id: 2 }], true));
    expect(setIds).not.toHaveBeenCalled();
  });
});
