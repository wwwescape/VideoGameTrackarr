import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useKeepAwake } from "../useKeepAwake";

const setWakeLock = (wakeLock: unknown) =>
  Object.defineProperty(navigator, "wakeLock", { value: wakeLock, configurable: true });

describe("useKeepAwake", () => {
  afterEach(() => {
    setWakeLock(undefined);
  });

  it("holds a screen wake lock while active and releases it after", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    setWakeLock({ request });

    const { result, unmount } = renderHook(() => useKeepAwake(true));
    await act(async () => {});

    expect(request).toHaveBeenCalledWith("screen");
    expect(result.current).toBe(false);
    unmount();
    expect(release).toHaveBeenCalled();
  });

  it("asks for the video without a Wake Lock (plain HTTP)", () => {
    setWakeLock(undefined);
    const { result } = renderHook(() => useKeepAwake(true));
    expect(result.current).toBe(true);
  });

  it("asks for the video when the wake lock is refused", async () => {
    setWakeLock({ request: vi.fn().mockRejectedValue(new Error("NotAllowedError")) });
    const { result } = renderHook(() => useKeepAwake(true));
    await act(async () => {});
    expect(result.current).toBe(true);
  });

  it("does nothing while inactive", () => {
    const request = vi.fn();
    setWakeLock({ request });
    const { result } = renderHook(() => useKeepAwake(false));
    expect(request).not.toHaveBeenCalled();
    expect(result.current).toBe(false);
  });
});
