import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useUndoRedo } from "@/shared/hooks/useUndoRedo";

describe("useUndoRedo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should initialize with initial value and disable undo/redo", () => {
    const { result } = renderHook(() => useUndoRedo("initial"));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("should commit value after debounce, enabling undo", () => {
    const { result } = renderHook(() => useUndoRedo("initial"));

    act(() => {
      result.current.push("update 1");
    });

    // Before debounce timer
    expect(result.current.canUndo).toBe(false);

    act(() => {
      vi.advanceTimersByTime(500); // DEBOUNCE_MS
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.undo()).toBe("initial");
  });

  it("should debounce rapid back-to-back pushes", () => {
    const { result } = renderHook(() => useUndoRedo("initial"));

    act(() => {
      result.current.push("u");
      result.current.push("up");
      result.current.push("upd");
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.canUndo).toBe(true);

    act(() => {
      expect(result.current.undo()).toBe("initial");
    });
  });

  it("should support undoing and redoing", () => {
    const { result } = renderHook(() => useUndoRedo("initial"));

    act(() => {
      result.current.push("first update");
      vi.advanceTimersByTime(500);
    });

    act(() => {
      result.current.push("second update");
      vi.advanceTimersByTime(500);
    });

    expect(result.current.canUndo).toBe(true);

    // Undo 1
    let undoneValue;
    act(() => {
      undoneValue = result.current.undo();
    });
    expect(undoneValue).toBe("first update");
    expect(result.current.canRedo).toBe(true);

    // Undo 2
    act(() => {
      undoneValue = result.current.undo();
    });
    expect(undoneValue).toBe("initial");
    expect(result.current.canUndo).toBe(false);

    // Redo 1
    let redoneValue;
    act(() => {
      redoneValue = result.current.redo();
    });
    expect(redoneValue).toBe("first update");
  });

  it("should clear pending pushes on undo", () => {
    const { result } = renderHook(() => useUndoRedo("start"));

    act(() => {
      result.current.push("pending update");
      // not advancing timers, so it's pending
    });

    act(() => {
      const state = result.current.undo();
      expect(state).toBe("start");
    });

    // The pending value should have been committed as history index 1,
    // and undo() should move to index 0 ("start").
    expect(result.current.canRedo).toBe(true);
    act(() => {
      expect(result.current.redo()).toBe("pending update");
    });
  });
});
