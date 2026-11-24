import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetGuidePosition, loadGuidePosition, saveGuidePosition } from "../guideReaderPosition";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

describe("guideReaderPosition", () => {
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("saves and restores a PDF page and a scroll position, per guide", () => {
    saveGuidePosition(1, "v1", { kind: "pdf", page: 12, scale: "page-width" });
    saveGuidePosition(2, "v1", { kind: "scroll", ratio: 0.4 });

    expect(loadGuidePosition(1, "v1")).toEqual({ kind: "pdf", page: 12, scale: "page-width" });
    expect(loadGuidePosition(2, "v1")).toEqual({ kind: "scroll", ratio: 0.4 });
    expect(localStorage.getItem("vgt.guideReader.1")).not.toBeNull();
  });

  it("ignores a place saved before the guide changed", () => {
    saveGuidePosition(1, "v1", { kind: "scroll", ratio: 0.9 });

    expect(loadGuidePosition(1, "v2")).toBeNull();
  });

  it("ignores something that isn't a place", () => {
    localStorage.setItem(
      "vgt.guideReader.1",
      JSON.stringify({ updatedAt: "v1", position: { kind: "scroll", ratio: 7 } })
    );
    localStorage.setItem("vgt.guideReader.2", "not json");

    expect(loadGuidePosition(1, "v1")).toBeNull();
    expect(loadGuidePosition(2, "v1")).toBeNull();
  });

  it("forgets a guide", () => {
    saveGuidePosition(1, "v1", { kind: "scroll", ratio: 0.5 });
    forgetGuidePosition(1);

    expect(loadGuidePosition(1, "v1")).toBeNull();
  });

  it("carries on when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });

    expect(() => saveGuidePosition(1, "v1", { kind: "scroll", ratio: 0.5 })).not.toThrow();
    expect(loadGuidePosition(1, "v1")).toBeNull();
    expect(() => forgetGuidePosition(1)).not.toThrow();
  });
});
