import { useEffect, useRef, useState, type MouseEvent } from "react";
import Box from "@mui/material/Box";
import { useTextFind } from "../../hooks/useTextFind";
import { FIND_MARK_SX, useFindBridge } from "./findMarks";
import type { GuideViewProps } from "./types";
import { useSavedScroll } from "./useSavedScroll";

const BLOCKED_ELEMENTS =
  "script, style, iframe, frame, object, embed, form, link, meta, base, input, button, textarea, select";

// A second, in-browser pass over the server's already-sanitised page (guide_service.sanitize_html)
// before any of it reaches the document: drop active elements and every event handler, inline
// style and javascript:/data: link the server should never have let through.
export function cleanGuideHtml(html: string): DocumentFragment {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const body = parsed.body;
  body.querySelectorAll(BLOCKED_ELEMENTS).forEach((element) => element.remove());
  body.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith("on") || name === "style" || name === "srcset") {
        element.removeAttribute(attribute.name);
      } else if (
        name === "href" &&
        !(value.startsWith("http://") || value.startsWith("https://") || value.startsWith("#"))
      ) {
        element.removeAttribute(attribute.name);
      } else if (name === "src" && !value.startsWith("data:image/")) {
        element.removeAttribute(attribute.name);
      }
    }
  });
  const fragment = document.createDocumentFragment();
  for (const node of Array.from(body.childNodes))
    fragment.appendChild(document.importNode(node, true));
  return fragment;
}

// A Word or Markdown guide, as the page the server converted and sanitised it into: shown in a
// reading column with the app's own typography and colours (so it follows light and dark), not
// in a frame. Links: within the document they scroll here; anything else opens a new tab.
const HtmlView = ({ guide, positionKey, url, find, onFindResult, onError }: GuideViewProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((html) => {
        const content = contentRef.current;
        if (!content) return;
        content.replaceChildren(cleanGuideHtml(html));
        setLoadedUrl(url);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) onError(error);
      });
    return () => controller.abort();
  }, [url, onError]);

  const ready = loadedUrl === url;
  useSavedScroll(scrollRef, positionKey, guide.updatedAt, ready);
  const textFind = useTextFind(contentRef, ready ? find.query : "", loadedUrl);
  useFindBridge(textFind, find, onFindResult);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor || !contentRef.current?.contains(anchor)) return;
    event.preventDefault();
    const href = anchor.getAttribute("href") ?? "";
    if (href.startsWith("#") && href.length > 1) {
      const target = contentRef.current.querySelector(`[id="${CSS.escape(href.slice(1))}"]`);
      target?.scrollIntoView({ block: "start" });
    } else if (/^https?:\/\//i.test(href)) {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Box ref={scrollRef} sx={{ flex: 1, overflow: "auto", bgcolor: "background.default" }}>
      <Box
        ref={contentRef}
        data-testid="guide-html"
        onClick={handleClick}
        sx={{
          maxWidth: "48rem",
          mx: "auto",
          px: { xs: 2, md: 3 },
          py: { xs: 2, md: 4 },
          color: "text.primary",
          fontSize: 16,
          lineHeight: 1.65,
          overflowWrap: "anywhere",
          "& h1, & h2, & h3, & h4, & h5, & h6": { lineHeight: 1.25, mt: 3, mb: 1, fontWeight: 700 },
          "& h1": { fontSize: "1.9rem" },
          "& h2": { fontSize: "1.5rem" },
          "& h3": { fontSize: "1.25rem" },
          "& p, & ul, & ol, & blockquote, & pre, & table, & figure": { my: 1.5 },
          "& a": { color: "primary.main" },
          "& img": { maxWidth: "100%", height: "auto" },
          "& blockquote": {
            borderLeft: 3,
            borderColor: "divider",
            pl: 2,
            ml: 0,
            color: "text.secondary",
          },
          "& pre, & code": {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: "0.9em",
          },
          "& pre": { p: 1.5, bgcolor: "vgt.surface2", borderRadius: 1, overflowX: "auto" },
          "& table": {
            display: "block",
            overflowX: "auto",
            borderCollapse: "collapse",
            maxWidth: "100%",
          },
          "& td, & th": { border: 1, borderColor: "divider", px: 1, py: 0.5, verticalAlign: "top" },
          "& th": { bgcolor: "vgt.surface2", fontWeight: 600 },
          // Word puts each cell's text in a paragraph; don't give it paragraph spacing.
          "& td > p, & th > p": { my: 0 },
          ...FIND_MARK_SX,
        }}
      />
    </Box>
  );
};

export default HtmlView;
