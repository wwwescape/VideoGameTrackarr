import type { Guide } from "../../api/types";

// What the reader tells a view about find on page, and what the view reports back.
export interface FindRequest {
  // The text to look for; empty while the find bar is closed.
  query: string;
  // Bumped by Next/Previous (Enter/Shift+Enter): go to the next or previous match.
  step: { seq: number; previous: boolean };
}

export interface FindResult {
  current: number;
  total: number;
  capped: boolean;
}

export interface GuideViewProps {
  guide: Guide;
  // A signed view link (already resolved to a full address).
  url: string;
  find: FindRequest;
  onFindResult: (result: FindResult) => void;
  // The view couldn't load its content.
  onError: (error: unknown) => void;
}
