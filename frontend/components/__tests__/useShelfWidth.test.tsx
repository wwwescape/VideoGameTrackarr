import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useShelfWidth } from "../BookshelfGrid";

// Regression: the shelf element only mounts after its data loads. A
// mount-once measurement effect read a null ref during the loading state
// and never ran again, so cold loads packed rows for a phantom 1200px
// shelf — overflowing the real screen and stalling the progressive
// loader. The width hook must measure the element when it appears and
// keep tracking resizes afterwards.
let stubbedWidth = 640;
const originalClientWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "clientWidth"
);

class FakeResizeObserver {
  static callback: ResizeObserverCallback | null = null;
  constructor(callback: ResizeObserverCallback) {
    FakeResizeObserver.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

function Harness() {
  const [loaded, setLoaded] = useState(false);
  const { shelfRef, shelfWidth } = useShelfWidth();
  return (
    <div>
      <span data-testid="width">{shelfWidth}</span>
      <button onClick={() => setLoaded(true)}>load</button>
      {loaded ? <div ref={shelfRef} data-testid="shelf" /> : <div>loading</div>}
    </div>
  );
}

describe("useShelfWidth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeResizeObserver.callback = null;
    if (originalClientWidth) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClientWidth);
    }
  });

  it("measures the shelf when it mounts after the loading state", () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => stubbedWidth,
    });
    render(<Harness />);
    // Still loading: no shelf element, width stays at the default.
    expect(screen.getByTestId("width")).toHaveTextContent("1200");
    fireEvent.click(screen.getByRole("button", { name: "load" }));
    expect(screen.getByTestId("width")).toHaveTextContent("640");
  });

  it("keeps tracking the shelf width on resize", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => stubbedWidth,
    });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "load" }));
    expect(screen.getByTestId("width")).toHaveTextContent("640");
    stubbedWidth = 800;
    act(() => {
      FakeResizeObserver.callback?.([], {} as ResizeObserver);
    });
    expect(screen.getByTestId("width")).toHaveTextContent("800");
    stubbedWidth = 640;
  });
});
