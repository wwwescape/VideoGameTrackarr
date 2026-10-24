import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLocalPreference } from "../useLocalPreference";

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => Array.from(items.keys())[index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

describe("useLocalPreference", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("remembers a value in this browser under the vgt.pref prefix", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    const first = renderHook(() => useLocalPreference("games.cardSize", 170));
    act(() => first.result.current[1](220));
    first.unmount();

    const second = renderHook(() => useLocalPreference("games.cardSize", 170));
    expect(second.result.current[0]).toBe(220);
    expect(localStorage.getItem("vgt.pref.games.cardSize")).toBe("220");
  });

  it("still works, without remembering, when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    const { result } = renderHook(() => useLocalPreference("games.view", "covers"));
    expect(result.current[0]).toBe("covers");
    act(() => result.current[1]("table"));
    expect(result.current[0]).toBe("table");
  });
});
