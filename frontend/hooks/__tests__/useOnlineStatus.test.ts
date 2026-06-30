import { act, renderHook } from "@testing-library/react";
import { onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { useOnlineStatus } from "../useOnlineStatus";

describe("useOnlineStatus", () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it("reflects the current onlineManager state", () => {
    onlineManager.setOnline(false);
    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(false);
  });

  it("updates when onlineManager's state changes", () => {
    onlineManager.setOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      onlineManager.setOnline(false);
    });
    expect(result.current).toBe(false);

    act(() => {
      onlineManager.setOnline(true);
    });
    expect(result.current).toBe(true);
  });
});
