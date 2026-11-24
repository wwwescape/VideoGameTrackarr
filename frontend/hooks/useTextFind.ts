import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

// Find on page for the Guides & Cheats reader's Word, Markdown and text views (PDFs use
// pdf.js's own find). Matches ignore case and accents, are wrapped in <mark> elements inside
// the container, and are removed again before every new search, so the DOM is always left as
// it was rendered.

export const MAX_MATCHES = 2000;
export const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;
const MARK_ATTRIBUTE = "data-guide-find";
export const ACTIVE_MARK_ATTRIBUTE = "data-active";

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

// Where `query` occurs in `text`, ignoring case and accents: [start, end) offsets into the
// original text. A folded character can be more than one code unit long (or none), so the
// folded text keeps a map back to where each of its characters came from.
export function findMatches(text: string, query: string, limit = MAX_MATCHES): [number, number][] {
  const needle = fold(query);
  if (!needle) return [];
  let folded = "";
  const origin: number[] = [];
  for (let index = 0; index < text.length; ) {
    const codePoint = text.codePointAt(index) ?? 0;
    const char = String.fromCodePoint(codePoint);
    const piece = fold(char);
    for (let k = 0; k < piece.length; k += 1) origin.push(index);
    folded += piece;
    index += char.length;
  }
  origin.push(text.length);
  const matches: [number, number][] = [];
  let from = 0;
  while (matches.length < limit) {
    const at = folded.indexOf(needle, from);
    if (at === -1) break;
    const end = at + needle.length;
    const originalEnd = end < origin.length - 1 ? origin[end] : text.length;
    matches.push([origin[at], originalEnd]);
    from = end;
  }
  return matches;
}

export function clearMarks(container: HTMLElement): void {
  const marks = container.querySelectorAll(`mark[${MARK_ATTRIBUTE}]`);
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

// Wraps every match in the container's text in a <mark>, in document order; at most `limit`.
export function markMatches(
  container: HTMLElement,
  query: string,
  limit = MAX_MATCHES
): HTMLElement[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
  const marks: HTMLElement[] = [];
  for (const node of nodes) {
    if (marks.length >= limit) break;
    const matches = findMatches(node.data, query, limit - marks.length);
    if (!matches.length) continue;
    const nodeMarks: HTMLElement[] = [];
    // From the end, so earlier offsets stay valid as the node is split.
    for (let index = matches.length - 1; index >= 0; index -= 1) {
      const [start, end] = matches[index];
      node.splitText(end);
      const middle = node.splitText(start);
      const mark = document.createElement("mark");
      mark.setAttribute(MARK_ATTRIBUTE, "");
      middle.parentNode?.replaceChild(mark, middle);
      mark.appendChild(middle);
      nodeMarks.unshift(mark);
    }
    marks.push(...nodeMarks);
  }
  return marks;
}

export interface TextFind {
  // 1-based position of the current match, 0 when there's none.
  current: number;
  total: number;
  // More than MAX_MATCHES: total stops there.
  capped: boolean;
  next: () => void;
  previous: () => void;
}

// `contentKey` changes whenever the container's content is replaced, so the search runs again.
export function useTextFind(
  containerRef: RefObject<HTMLElement | null>,
  query: string,
  contentKey: unknown
): TextFind {
  const marksRef = useRef<HTMLElement[]>([]);
  const [total, setTotal] = useState(0);
  const [capped, setCapped] = useState(false);
  const [current, setCurrent] = useState(0);

  const activate = useCallback((index: number) => {
    const marks = marksRef.current;
    marks.forEach((mark) => mark.removeAttribute(ACTIVE_MARK_ATTRIBUTE));
    const mark = marks[index];
    if (!mark) return;
    mark.setAttribute(ACTIVE_MARK_ATTRIBUTE, "");
    mark.scrollIntoView?.({ block: "center" });
    setCurrent(index + 1);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const timer = window.setTimeout(() => {
      clearMarks(container);
      marksRef.current = [];
      if (query.trim().length < MIN_QUERY_LENGTH) {
        setTotal(0);
        setCapped(false);
        setCurrent(0);
        return;
      }
      const marks = markMatches(container, query.trim(), MAX_MATCHES + 1);
      const isCapped = marks.length > MAX_MATCHES;
      if (isCapped) {
        // One past the cap only tells us there are more; don't leave it highlighted.
        const extra = marks.pop();
        if (extra) {
          const parent = extra.parentNode;
          while (extra.firstChild) parent?.insertBefore(extra.firstChild, extra);
          parent?.removeChild(extra);
        }
      }
      marksRef.current = marks;
      setTotal(marks.length);
      setCapped(isCapped);
      if (marks.length) activate(0);
      else setCurrent(0);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [containerRef, query, contentKey, activate]);

  // Leave the content clean when the reader or the find bar goes away.
  useEffect(() => {
    const container = containerRef.current;
    return () => {
      if (container) clearMarks(container);
    };
  }, [containerRef]);

  const next = useCallback(() => {
    const count = marksRef.current.length;
    if (count) activate(current % count);
  }, [activate, current]);

  const previous = useCallback(() => {
    const count = marksRef.current.length;
    if (count) activate((current - 2 + count) % count);
  }, [activate, current]);

  return { current, total, capped, next, previous };
}
