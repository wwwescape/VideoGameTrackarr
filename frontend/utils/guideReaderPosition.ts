// Where you were in each document, so the reader opens it there again. Kept in this browser only
// (localStorage), one small entry per document key (see utils/guides.documentPositionKey); storage can throw (private window, blocked
// site data), and then the reader simply starts at the top. An entry remembers the guide's
// updatedAt: once the file is replaced or the entry edited, the old place no longer applies.

const PREFIX = "vgt.guideReader.";

export type GuidePosition =
  // A PDF: the page and the zoom (a pdf.js scale value: a number, or "page-width"/"page-fit").
  | { kind: "pdf"; page: number; scale: string }
  // Rendered Word/Markdown or text: how far down, 0..1.
  | { kind: "scroll"; ratio: number };

interface StoredPosition {
  updatedAt: string;
  position: GuidePosition;
}

function isPosition(value: unknown): value is GuidePosition {
  if (!value || typeof value !== "object") return false;
  const position = value as Record<string, unknown>;
  if (position.kind === "pdf") {
    return (
      typeof position.page === "number" && position.page >= 1 && typeof position.scale === "string"
    );
  }
  if (position.kind === "scroll") {
    return typeof position.ratio === "number" && position.ratio >= 0 && position.ratio <= 1;
  }
  return false;
}

export function loadGuidePosition(
  guideId: string | number,
  updatedAt: string
): GuidePosition | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + guideId);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredPosition>;
    if (stored.updatedAt !== updatedAt || !isPosition(stored.position)) return null;
    return stored.position;
  } catch {
    return null;
  }
}

export function saveGuidePosition(
  guideId: string | number,
  updatedAt: string,
  position: GuidePosition
): void {
  try {
    const stored: StoredPosition = { updatedAt, position };
    window.localStorage.setItem(PREFIX + guideId, JSON.stringify(stored));
  } catch {
    // The reader still works; it just won't remember the place.
  }
}

export function forgetGuidePosition(guideId: string | number): void {
  try {
    window.localStorage.removeItem(PREFIX + guideId);
  } catch {
    // Nothing to clean up if storage isn't available.
  }
}
