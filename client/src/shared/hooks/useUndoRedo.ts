import { useRef, useCallback, useState } from "react";

const MAX_HISTORY = 100;
const DEBOUNCE_MS = 500;

interface UseUndoRedoReturn {
  push: (value: string) => void;
  undo: () => string | null;
  redo: () => string | null;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Custom undo/redo history hook for controlled text inputs.
 * Debounces push calls so rapid typing collapses into a single snapshot.
 */
export function useUndoRedo(initialValue: string): UseUndoRedoReturn {
  const historyRef = useRef<string[]>([initialValue]);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // pendingRef holds the latest value during debounce window
  const pendingRef = useRef<string | null>(null);

  // Reactive state for canUndo/canRedo re-renders
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateFlags = useCallback(() => {
    setCanUndo(indexRef.current > 0);
    setCanRedo(indexRef.current < historyRef.current.length - 1);
  }, []);

  // Commit a snapshot immediately (used internally)
  const commit = useCallback(
    (value: string) => {
      const history = historyRef.current;
      const idx = indexRef.current;

      // Skip duplicate
      if (history[idx] === value) return;

      // Discard any redo entries beyond current index
      historyRef.current = history.slice(0, idx + 1);
      historyRef.current.push(value);

      // Enforce max history limit
      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current = historyRef.current.slice(historyRef.current.length - MAX_HISTORY);
      }

      indexRef.current = historyRef.current.length - 1;
      updateFlags();
    },
    [updateFlags],
  );

  const push = useCallback(
    (value: string) => {
      pendingRef.current = value;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        if (pendingRef.current !== null) {
          commit(pendingRef.current);
          pendingRef.current = null;
        }
      }, DEBOUNCE_MS);
    },
    [commit],
  );

  const undo = useCallback((): string | null => {
    // Flush any pending debounced value before undoing
    if (pendingRef.current !== null) {
      if (timerRef.current) clearTimeout(timerRef.current);
      commit(pendingRef.current);
      pendingRef.current = null;
    }

    if (indexRef.current <= 0) return null;
    indexRef.current -= 1;
    updateFlags();
    return historyRef.current[indexRef.current];
  }, [commit, updateFlags]);

  const redo = useCallback((): string | null => {
    if (indexRef.current >= historyRef.current.length - 1) return null;
    indexRef.current += 1;
    updateFlags();
    return historyRef.current[indexRef.current];
  }, [updateFlags]);

  return { push, undo, redo, canUndo, canRedo };
}
