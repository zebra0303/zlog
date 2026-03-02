export interface ShortcutResult {
  newValue: string;
  newStart: number;
  newEnd: number;
}

/**
 * Processes Tab/Shift+Tab and Enter keyboard shortcuts for the Markdown editor.
 * Returns the modified string and new cursor positions if the shortcut was handled,
 * or null if the shortcut is not recognized or should not be intercepted.
 */
export function processEditorShortcuts(
  key: string,
  shiftKey: boolean,
  isComposing: boolean,
  ctrlKey: boolean,
  metaKey: boolean,
  selectionStart: number,
  selectionEnd: number,
  value: string,
): ShortcutResult | null {
  // Enter key: auto-continue list items (skip during IME composition)
  if (
    key === "Enter" &&
    !isComposing &&
    !shiftKey &&
    !ctrlKey &&
    !metaKey &&
    selectionStart === selectionEnd
  ) {
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const currentLine = value.slice(lineStart, selectionStart);
    const listMatch = /^(\s*)([-*]|\d+\.)\s/.exec(currentLine);

    if (listMatch) {
      const [, indent, marker] = listMatch;
      const emptyMatch = /^(\s*)([-*]|\d+\.)\s*$/.exec(currentLine);

      if (emptyMatch) {
        // Empty list item - remove marker to end the list
        const newValue = value.slice(0, lineStart) + "\n" + value.slice(selectionStart);
        const newCursor = lineStart + 1;
        return { newValue, newStart: newCursor, newEnd: newCursor };
      } else {
        // Continue list: always use "1." for ordered lists (markdown auto-numbers)
        const nextMarker = /^\d+\./.test(marker ?? "") ? "1." : marker;
        const insertion = `\n${indent}${nextMarker} `;
        const newValue = value.slice(0, selectionStart) + insertion + value.slice(selectionEnd);
        const newCursor = selectionStart + insertion.length;
        return { newValue, newStart: newCursor, newEnd: newCursor };
      }
    }
  }

  if (key !== "Tab") return null;

  // Uniform 3-space indent for both ordered and unordered lists
  const indentStr = "   ";

  if (selectionStart === selectionEnd) {
    // No selection - single cursor
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    if (shiftKey) {
      // Outdent: remove up to 3 leading spaces
      const linePrefix = value.slice(lineStart, selectionStart);
      const spacesToRemove = linePrefix.startsWith("   ")
        ? 3
        : linePrefix.startsWith("  ")
          ? 2
          : linePrefix.startsWith(" ")
            ? 1
            : 0;
      if (spacesToRemove === 0) return null;
      const newValue = value.slice(0, lineStart) + value.slice(lineStart + spacesToRemove);
      const newCursor = selectionStart - spacesToRemove;
      return { newValue, newStart: newCursor, newEnd: newCursor };
    } else {
      // Indent: insert 3 spaces at line start
      const newValue = value.slice(0, lineStart) + indentStr + value.slice(lineStart);
      const newCursor = selectionStart + indentStr.length;
      return { newValue, newStart: newCursor, newEnd: newCursor };
    }
  } else {
    // Block selection - indent/outdent each line
    const blockStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const selectedText = value.slice(blockStart, selectionEnd);
    const lines = selectedText.split("\n");
    let offset = 0; // cumulative shift for selectionStart line
    let totalOffset = 0;

    const newLines = lines.map((line, i) => {
      if (shiftKey) {
        const spacesToRemove = line.startsWith("   ")
          ? 3
          : line.startsWith("  ")
            ? 2
            : line.startsWith(" ")
              ? 1
              : 0;
        if (i === 0) offset = -spacesToRemove;
        totalOffset -= spacesToRemove;
        return line.slice(spacesToRemove);
      } else {
        if (i === 0) offset = indentStr.length;
        totalOffset += indentStr.length;
        return indentStr + line;
      }
    });

    const newValue = value.slice(0, blockStart) + newLines.join("\n") + value.slice(selectionEnd);
    const newStart = Math.max(blockStart, selectionStart + offset);
    const newEnd = selectionEnd + totalOffset;
    return { newValue, newStart, newEnd };
  }
}
