import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMarks, findMatches, markMatches, useTextFind } from "../useTextFind";

describe("findMatches", () => {
  it("ignores case and accents", () => {
    expect(findMatches("Café CAFE cafe", "cafe")).toEqual([
      [0, 4],
      [5, 9],
      [10, 14],
    ]);
    expect(findMatches("Pokémon", "POKEMON")).toEqual([[0, 7]]);
  });

  it("stops at the limit", () => {
    expect(findMatches("aa aa aa aa", "aa", 2)).toHaveLength(2);
  });

  it("finds nothing for an empty query", () => {
    expect(findMatches("anything", "")).toEqual([]);
  });
});

describe("markMatches / clearMarks", () => {
  it("wraps matches across elements and leaves the content as it was afterwards", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>Boss: <b>boss</b> fight</p><p>No match here</p>";
    const before = container.innerHTML;

    const marks = markMatches(container, "boss");

    expect(marks.map((mark) => mark.textContent)).toEqual(["Boss", "boss"]);
    expect(container.querySelectorAll("mark")).toHaveLength(2);
    clearMarks(container);
    expect(container.innerHTML).toBe(before);
  });
});

describe("useTextFind", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(text: string) {
    const container = document.createElement("pre");
    container.textContent = text;
    document.body.appendChild(container);
    const ref = { current: container };
    return { container, ref };
  }

  it("counts matches, moves through them and wraps around", () => {
    const { ref, container } = setup("ring one ring two ring three");
    const { result } = renderHook(({ query }) => useTextFind(ref, query, 1), {
      initialProps: { query: "ring" },
    });

    act(() => vi.advanceTimersByTime(250));
    expect(result.current.total).toBe(3);
    expect(result.current.current).toBe(1);
    expect(container.querySelector("mark[data-active]")).not.toBeNull();

    act(() => result.current.next());
    expect(result.current.current).toBe(2);
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.current).toBe(1);
    act(() => result.current.previous());
    expect(result.current.current).toBe(3);
    container.remove();
  });

  it("doesn't search for less than two characters, and cleans up", () => {
    const { ref, container } = setup("a b c");
    const { result, rerender } = renderHook(({ query }) => useTextFind(ref, query, 1), {
      initialProps: { query: "b c" },
    });
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.total).toBe(1);

    rerender({ query: "b" });
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.total).toBe(0);
    expect(container.querySelector("mark")).toBeNull();
    expect(container.textContent).toBe("a b c");
    container.remove();
  });

  it("caps the count", () => {
    const { ref, container } = setup("xy ".repeat(2100));
    const { result } = renderHook(() => useTextFind(ref, "xy", 1));

    act(() => vi.advanceTimersByTime(250));

    expect(result.current.total).toBe(2000);
    expect(result.current.capped).toBe(true);
    expect(container.querySelectorAll("mark")).toHaveLength(2000);
    container.remove();
  });
});
