import { useEffect } from "react";
import type { TextFind } from "../../hooks/useTextFind";
import type { FindRequest, FindResult } from "./types";

// How the reader's find marks look in the Word/Markdown and text views.
export const FIND_MARK_SX = {
  "& mark[data-guide-find]": { bgcolor: "warning.light", color: "inherit", borderRadius: "2px" },
  "& mark[data-guide-find][data-active]": {
    bgcolor: "warning.main",
    outline: "2px solid",
    outlineColor: "warning.dark",
  },
};

// Connects a view's useTextFind to the reader: Next/Previous steps, and the count it shows.
export function useFindBridge(
  find: TextFind,
  request: FindRequest,
  onFindResult: (result: FindResult) => void
) {
  const { current, total, capped, next, previous } = find;
  useEffect(() => {
    onFindResult({ current, total, capped });
  }, [current, total, capped, onFindResult]);

  useEffect(() => {
    if (request.step.seq === 0) return;
    if (request.step.previous) previous();
    else next();
    // Only a new step moves; next/previous change with every match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.step]);
}
