import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, preloadPages, RELOADED_FOR_UPDATE } from "../lazyPage";

const Stub = () => null;
const reload = vi.fn();
const originalLocation = window.location;

beforeEach(() => {
  window.sessionStorage.clear();
  reload.mockClear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, reload },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

describe("page", () => {
  it("renders the loaded page", async () => {
    const route = await page(() => Promise.resolve({ default: Stub }))();

    expect(route.element.type).toBe(Stub);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once when a page file is gone after an update", async () => {
    const missing = () =>
      Promise.reject(new TypeError("Failed to fetch dynamically imported module"));

    // The first failure reloads and never settles (the page is going away).
    const settled = vi.fn();
    void page(missing)().then(settled, settled);
    await Promise.resolve();
    await Promise.resolve();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(RELOADED_FOR_UPDATE)).toBe("1");
    expect(settled).not.toHaveBeenCalled();

    // Still missing after that reload: show the error instead of reloading forever.
    await expect(page(missing)()).rejects.toThrow("Failed to fetch dynamically imported module");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("allows another reload after a page loads again", async () => {
    window.sessionStorage.setItem(RELOADED_FOR_UPDATE, "1");

    await page(() => Promise.resolve({ default: Stub }))();

    expect(window.sessionStorage.getItem(RELOADED_FOR_UPDATE)).toBeNull();
  });
});

describe("preloadPages", () => {
  it("fetches every page and ignores failures without reloading", async () => {
    const ok = vi.fn(() => Promise.resolve({ default: Stub }));
    const failing = vi.fn(() => Promise.reject(new Error("offline")));
    page(ok);
    page(failing);

    preloadPages();
    await Promise.resolve();

    expect(ok).toHaveBeenCalled();
    expect(failing).toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
