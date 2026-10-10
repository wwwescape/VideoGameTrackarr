import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../clipboard";

describe("copyText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the Clipboard API in a secure context", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await copyText("http://example.test/public/abc/games");

    expect(writeText).toHaveBeenCalledWith("http://example.test/public/abc/games");
  });

  it("falls back to execCommand over plain HTTP, where the Clipboard API is missing", async () => {
    vi.stubGlobal("isSecureContext", false);
    vi.stubGlobal("navigator", {});
    let copied: string | undefined;
    document.execCommand = vi.fn(() => {
      copied = (document.activeElement as HTMLTextAreaElement | null)?.value;
      return true;
    });

    await copyText("http://192.168.0.2/public/abc/games");

    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(copied).toBe("http://192.168.0.2/public/abc/games");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("rejects when the fallback copy is refused", async () => {
    vi.stubGlobal("isSecureContext", false);
    vi.stubGlobal("navigator", {});
    document.execCommand = vi.fn(() => false);

    await expect(copyText("x")).rejects.toThrow();
  });
});
