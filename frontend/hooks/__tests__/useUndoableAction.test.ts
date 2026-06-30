import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUndoableAction } from "../useUndoableAction";

interface Item {
  id: number;
}

describe("useUndoableAction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks scheduled items as pending immediately", () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useUndoableAction<Item>({ getId: (item) => item.id, onCommit }));

    act(() => {
      result.current.schedule([{ id: 1 }, { id: 2 }]);
    });

    expect(result.current.isPending(1)).toBe(true);
    expect(result.current.isPending(2)).toBe(true);
    expect(result.current.isPending(3)).toBe(false);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits after the delay elapses and clears pending state", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useUndoableAction<Item>({ getId: (item) => item.id, onCommit, delayMs: 1000 })
    );

    act(() => {
      result.current.schedule([{ id: 1 }]);
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      // let the committed promise's .finally() run
      await Promise.resolve();
    });

    expect(onCommit).toHaveBeenCalledWith([{ id: 1 }]);
    expect(result.current.isPending(1)).toBe(false);
  });

  it("undo cancels the commit and clears pending state without calling onCommit", () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useUndoableAction<Item>({ getId: (item) => item.id, onCommit, delayMs: 1000 })
    );

    let undo!: () => void;
    act(() => {
      ({ undo } = result.current.schedule([{ id: 1 }]));
    });

    act(() => {
      undo();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.isPending(1)).toBe(false);
  });

  it("calling undo twice is a no-op the second time", () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useUndoableAction<Item>({ getId: (item) => item.id, onCommit, delayMs: 1000 })
    );

    let undo!: () => void;
    act(() => {
      ({ undo } = result.current.schedule([{ id: 1 }]));
    });

    act(() => {
      undo();
      undo();
    });

    expect(result.current.isPending(1)).toBe(false);
  });

  it("tracks independently-scheduled batches separately", () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useUndoableAction<Item>({ getId: (item) => item.id, onCommit, delayMs: 1000 })
    );

    let undoFirst!: () => void;
    act(() => {
      ({ undo: undoFirst } = result.current.schedule([{ id: 1 }]));
      result.current.schedule([{ id: 2 }]);
    });

    act(() => {
      undoFirst();
    });

    expect(result.current.isPending(1)).toBe(false);
    expect(result.current.isPending(2)).toBe(true);
  });
});
