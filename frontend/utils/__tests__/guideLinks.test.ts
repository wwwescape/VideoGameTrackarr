import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Guide } from "../../api/types";
import { openGuideInNewTab, serverDetail } from "../guideLinks";

const createGuideViewLink = vi.fn();
vi.mock("../../api/documents", () => ({
  createDocumentViewLink: (...args: unknown[]) => createGuideViewLink(...args),
}));

const GUIDE = { id: 1, name: "Walkthrough" } as Guide;

describe("openGuideInNewTab", () => {
  const openSpy = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("open", openSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("opens the tab during the click, cuts it off, then points it at the view link", async () => {
    const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
    openSpy.mockReturnValue(tab);
    createGuideViewLink.mockResolvedValue("/api/guides/1/content/tok/walkthrough.pdf");

    await openGuideInNewTab({ type: "game", id: 5 }, GUIDE, vi.fn());

    expect(openSpy).toHaveBeenCalledWith("", "_blank");
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toMatch(/\/api\/guides\/1\/content\/tok\/walkthrough\.pdf$/);
  });

  it("closes the tab and reports the error when there's no link", async () => {
    const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
    openSpy.mockReturnValue(tab);
    const failure = new Error("nope");
    createGuideViewLink.mockRejectedValue(failure);
    const onError = vi.fn();

    await openGuideInNewTab({ type: "game", id: 5 }, GUIDE, onError);

    expect(tab.close).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(failure);
  });
});

describe("serverDetail", () => {
  it("reads the server's message, or nothing", () => {
    expect(serverDetail({ response: { data: { detail: "Too big" } } })).toBe("Too big");
    expect(serverDetail({ response: { data: { detail: [{ msg: "x" }] } } })).toBeUndefined();
    expect(serverDetail(new Error("x"))).toBeUndefined();
  });
});
