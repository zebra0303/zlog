import { useCallback } from "react";

interface UseMarkdownActionsProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
}

export function useMarkdownActions({ textareaRef, value, onChange }: UseMarkdownActionsProps) {
  const restoreCursor = useCallback(
    (start: number, end: number) => {
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        textarea.selectionStart = start;
        textarea.selectionEnd = end;
      });
    },
    [textareaRef],
  );

  const applyWrap = useCallback(
    (prefix: string, suffix: string, placeholder: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = value.slice(start, end);
      const text = selected || placeholder;
      const newValue = value.slice(0, start) + prefix + text + suffix + value.slice(end);
      onChange(newValue);
      if (selected) {
        restoreCursor(start + prefix.length, start + prefix.length + text.length);
      } else {
        restoreCursor(start + prefix.length, start + prefix.length + placeholder.length);
      }
    },
    [textareaRef, value, onChange, restoreCursor],
  );

  const applyLinePrefix = useCallback(
    (prefix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const newValue = value.slice(0, lineStart) + prefix + value.slice(lineStart);
      onChange(newValue);
      restoreCursor(start + prefix.length, start + prefix.length);
    },
    [textareaRef, value, onChange, restoreCursor],
  );

  const applyInsert = useCallback(
    (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const newValue = value.slice(0, start) + text + value.slice(start);
      onChange(newValue);
      restoreCursor(start + text.length, start + text.length);
    },
    [textareaRef, value, onChange, restoreCursor],
  );

  return {
    applyWrap,
    applyLinePrefix,
    applyInsert,
  };
}
