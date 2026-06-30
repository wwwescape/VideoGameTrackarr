import { useCallback, useEffect, useRef, useState } from "react";

interface UseUndoableActionOptions<T> {
  getId: (item: T) => number;
  onCommit: (items: T[]) => Promise<void>;
  delayMs?: number;
}

interface ScheduledAction {
  undo: () => void;
}

const DEFAULT_DELAY_MS = 5000;

// Stages an action (typically a delete) instead of running it immediately: the affected
// ids are marked "pending" right away so callers can hide/disable them optimistically,
// then `onCommit` actually fires only after `delayMs` unless `undo()` is called first.
// Pairs with a toast that offers an "Undo" button — see GameListPage/GameLibrarySection.
export function useUndoableAction<T>({ getId, onCommit, delayMs = DEFAULT_DELAY_MS }: UseUndoableActionOptions<T>) {
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(new Set());
  const timeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const nextBatchIdRef = useRef(0);

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      timeouts.clear();
    };
  }, []);

  const schedule = useCallback(
    (items: T[]): ScheduledAction => {
      const batchId = nextBatchIdRef.current++;
      const ids = items.map(getId);

      setPendingIds((prev) => new Set([...prev, ...ids]));

      const clearPending = () => {
        setPendingIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      };

      const timeoutId = setTimeout(() => {
        timeoutsRef.current.delete(batchId);
        void onCommit(items).finally(clearPending);
      }, delayMs);
      timeoutsRef.current.set(batchId, timeoutId);

      return {
        undo: () => {
          const pendingTimeout = timeoutsRef.current.get(batchId);
          if (!pendingTimeout) {
            return;
          }
          clearTimeout(pendingTimeout);
          timeoutsRef.current.delete(batchId);
          clearPending();
        },
      };
    },
    [getId, onCommit, delayMs]
  );

  const isPending = useCallback((id: number) => pendingIds.has(id), [pendingIds]);

  return { schedule, isPending, delayMs };
}
