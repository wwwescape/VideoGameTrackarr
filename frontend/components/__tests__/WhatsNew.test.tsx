import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WhatsNewInfo } from "../../api/types";
import MarkdownText, { parseMarkdown } from "../MarkdownText";
import WhatsNewDialog from "../WhatsNewDialog";

const markSeen = vi.fn();
let whatsNew: WhatsNewInfo | undefined;
vi.mock("../../hooks/useVersion", () => ({
  useWhatsNew: () => ({ data: whatsNew }),
  useMarkWhatsNewSeen: () => ({ mutate: markSeen, isPending: false }),
}));

const NOTES = `Toys to Life arrives, starting with LEGO Dimensions.

## ✨ New: Toys to Life
Track every pack.

- **Toys to Life** in the sidebar
  - nested detail
- Fixed #42, see https://example.com/more and [the README](https://github.com/wwwescape/videogametrackarr#readme)
  continued on the next line
- [bad](javascript:alert(1)) stays text`;

describe("parseMarkdown", () => {
  it("reads headings, paragraphs and nested lists", () => {
    const blocks = parseMarkdown(NOTES);

    expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "heading", "paragraph", "list"]);
    const list = blocks[3];
    if (list.kind !== "list") throw new Error("expected a list");
    expect(list.items).toHaveLength(3);
    expect(list.items[0].children.map((child) => child.text)).toEqual(["nested detail"]);
    expect(list.items[1].text).toMatch(/continued on the next line$/);
  });
});

describe("MarkdownText", () => {
  it("links only http(s) addresses and issue numbers", () => {
    render(<MarkdownText text={NOTES} repoUrl="https://github.com/wwwescape/videogametrackarr" />);

    expect(screen.getByRole("heading", { name: "✨ New: Toys to Life" })).toBeInTheDocument();
    expect(screen.getByText("Toys to Life", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#42" })).toHaveAttribute(
      "href",
      "https://github.com/wwwescape/videogametrackarr/issues/42"
    );
    expect(screen.getByRole("link", { name: "the README" })).toHaveAttribute(
      "href",
      "https://github.com/wwwescape/videogametrackarr#readme"
    );
    expect(screen.getByRole("link", { name: "https://example.com/more" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "bad" })).toBeNull();
    expect(screen.getByText(/bad/)).toBeInTheDocument();
  });
});

describe("WhatsNewDialog", () => {
  beforeEach(() => {
    markSeen.mockReset();
  });

  it("shows each unseen release and marks them seen when closed", async () => {
    whatsNew = {
      currentVersion: "2.7.0",
      releases: [
        { version: "2.7.0", name: "v2.7.0", body: "## ⚡ Improvements\n- Faster", url: "https://github.com/o/r/releases/tag/v2.7.0", publishedAt: "2026-11-02T10:00:00Z" },
        { version: "2.6.1", name: "v2.6.1", body: "## 🐛 Fixes\n- Fixed a thing", url: "https://github.com/o/r/releases/tag/v2.6.1", publishedAt: null },
      ],
      notesUnavailable: false,
      releaseUrl: "https://github.com/o/r/releases/tag/v2.7.0",
    };
    const user = userEvent.setup();
    render(<WhatsNewDialog />);

    expect(screen.getByRole("dialog", { name: /What's New/ })).toBeInTheDocument();
    expect(screen.getByText("VideoGameTrackarr was updated to v2.7.0.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "v2.7.0" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "v2.6.1" })).toBeInTheDocument();
    expect(screen.getByText("Fixed a thing")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(markSeen).toHaveBeenCalledTimes(1);
  });

  it("links to the release when the notes couldn't be loaded", () => {
    whatsNew = { currentVersion: "2.7.0", releases: [], notesUnavailable: true, releaseUrl: "https://github.com/o/r/releases/tag/v2.7.0" };
    render(<WhatsNewDialog />);

    expect(screen.getByRole("link", { name: "Read them on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/o/r/releases/tag/v2.7.0"
    );
  });

  it("shows nothing when there's nothing new", () => {
    whatsNew = { currentVersion: "2.7.0", releases: [], notesUnavailable: false, releaseUrl: "u" };
    render(<WhatsNewDialog />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
