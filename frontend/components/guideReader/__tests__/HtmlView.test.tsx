import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Guide } from "../../../api/types";
import HtmlView, { cleanGuideHtml } from "../HtmlView";

const GUIDE = { id: 3, name: "Notes", updatedAt: "v1", mediaFormat: "docx" } as Guide;
const FIND = { query: "", step: { seq: 0, previous: false } };

function serialize(fragment: DocumentFragment): string {
  const box = document.createElement("div");
  box.appendChild(fragment);
  return box.innerHTML;
}

describe("cleanGuideHtml", () => {
  it("strips anything active the server should already have removed", () => {
    const html = serialize(
      cleanGuideHtml(
        `<!doctype html><html><head><title>t</title><style>p{}</style></head><body>
          <p style="color:red" onclick="x()">Hello</p><script>alert(1)</script>
          <iframe src="https://evil.test"></iframe><form><input></form>
          <a href="javascript:alert(1)">js</a><a href="https://example.com">ok</a><a href="#guide-top">up</a>
          <img src="https://tracker.test/p.gif"><img src="data:image/png;base64,AAAA" alt="map">
        </body></html>`
      )
    );

    for (const banned of [
      "script",
      "style",
      "iframe",
      "form",
      "input",
      "onclick",
      "javascript:",
      "tracker.test",
      "<title",
    ]) {
      expect(html).not.toContain(banned);
    }
    expect(html).toContain("<p>Hello</p>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('href="#guide-top"');
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });
});

describe("HtmlView", () => {
  const openSpy = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("open", openSpy);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          '<html><body><p><a href="#guide-end">Jump</a> <a href="https://example.com/x">Site</a></p><h2 id="guide-end">End</h2></body></html>',
      }))
    );
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    openSpy.mockReset();
  });

  it("shows the page, scrolls in-page links and opens other links in a new tab", async () => {
    const user = userEvent.setup();
    render(
      <HtmlView
        guide={GUIDE}
        url="https://app.test/view"
        find={FIND}
        onFindResult={vi.fn()}
        onError={vi.fn()}
      />
    );

    await screen.findByText("End");
    await user.click(screen.getByText("Jump"));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();

    await user.click(screen.getByText("Site"));
    expect(openSpy).toHaveBeenCalledWith("https://example.com/x", "_blank", "noopener,noreferrer");
  });

  it("reports a page that can't be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, text: async () => "" }))
    );
    const onError = vi.fn();

    render(
      <HtmlView
        guide={GUIDE}
        url="https://app.test/view"
        find={FIND}
        onFindResult={vi.fn()}
        onError={onError}
      />
    );

    await waitFor(() => expect(onError).toHaveBeenCalled());
  });
});
