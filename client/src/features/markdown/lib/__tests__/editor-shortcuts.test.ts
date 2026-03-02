import { describe, test, expect } from "vitest";
import { processEditorShortcuts } from "../editor-shortcuts";

describe("processEditorShortcuts", () => {
  describe("Enter key: Auto-list continuation", () => {
    test("ignores Enter when composing", () => {
      const result = processEditorShortcuts("Enter", false, true, false, false, 2, 2, "- ");
      expect(result).toBeNull();
    });

    test("ignores Enter if shift/ctrl/meta is pressed", () => {
      const result = processEditorShortcuts("Enter", true, false, false, false, 2, 2, "- ");
      expect(result).toBeNull();
    });

    test("continues bullet list", () => {
      const result = processEditorShortcuts("Enter", false, false, false, false, 6, 6, "- item");
      expect(result).toEqual({
        newValue: "- item\n- ",
        newStart: 9,
        newEnd: 9,
      });
    });

    test("continues indented bullet list", () => {
      const result = processEditorShortcuts("Enter", false, false, false, false, 9, 9, "   * item");
      expect(result).toEqual({
        newValue: "   * item\n   * ",
        newStart: 15,
        newEnd: 15,
      });
    });

    test("continues ordered list always with '1.'", () => {
      const result = processEditorShortcuts("Enter", false, false, false, false, 9, 9, "42. hello");
      expect(result).toEqual({
        newValue: "42. hello\n1. ",
        newStart: 13,
        newEnd: 13,
      });
    });

    test("stops empty list item on Enter", () => {
      // User pressed Enter on a line that only had a list marker and a space
      const result = processEditorShortcuts("Enter", false, false, false, false, 2, 2, "- ");
      expect(result).toEqual({
        newValue: "\n",
        newStart: 1,
        newEnd: 1,
      });
    });

    test("stops empty indented ordered list item on Enter", () => {
      const text = "hello\n   1. ";
      const result = processEditorShortcuts("Enter", false, false, false, false, 12, 12, text);
      expect(result).toEqual({
        // the marker '   1. ' is removed, replaced with a newline
        newValue: "hello\n\n",
        newStart: 7,
        newEnd: 7,
      });
    });
  });

  describe("Tab key: Indent / Outdent", () => {
    describe("Single cursor formatting", () => {
      test("indents text with 3 spaces", () => {
        const text = "hello";
        const result = processEditorShortcuts("Tab", false, false, false, false, 2, 2, text);
        // "he" -> "   hello" because it indents the whole line
        expect(result).toEqual({
          newValue: "   hello",
          newStart: 5,
          newEnd: 5,
        });
      });

      test("indents text with 3 spaces on specific line", () => {
        const text = "line1\nline2\nline3";
        // cursor in the middle of line2
        const result = processEditorShortcuts("Tab", false, false, false, false, 8, 8, text);
        expect(result).toEqual({
          newValue: "line1\n   line2\nline3",
          newStart: 11,
          newEnd: 11,
        });
      });

      test("outdents text with 3 spaces", () => {
        const text = "   hello";
        const result = processEditorShortcuts("Tab", true, false, false, false, 5, 5, text);
        expect(result).toEqual({
          newValue: "hello",
          newStart: 2,
          newEnd: 2,
        });
      });

      test("outdents text with 2 spaces", () => {
        const text = "  hello";
        const result = processEditorShortcuts("Tab", true, false, false, false, 4, 4, text);
        expect(result).toEqual({
          newValue: "hello",
          newStart: 2,
          newEnd: 2,
        });
      });

      test("does not outdent text with 0 spaces", () => {
        const text = "hello";
        const result = processEditorShortcuts("Tab", true, false, false, false, 2, 2, text);
        expect(result).toBeNull();
      });
    });

    describe("Block selection formatting", () => {
      test("indents multiple lines with 3 spaces", () => {
        const text = "line1\nline2\nline3";
        // Select "2\nline3" (跨越 line2 line3)
        // line1\nline2\nline3
        // 012345 67890 123456
        const result = processEditorShortcuts("Tab", false, false, false, false, 10, 15, text);
        expect(result).toEqual({
          newValue: "line1\n   line2\n   line3",
          newStart: 13,
          newEnd: 21,
        });
      });

      test("outdents multiple lines", () => {
        const text = "line1\n   line2\n  line3";
        // Select from inside line2 to inside line3
        // line1\n   l
        // 012345 6789
        const result = processEditorShortcuts("Tab", true, false, false, false, 9, 18, text);
        expect(result).toEqual({
          newValue: "line1\nline2\nline3",
          newStart: 6,
          newEnd: 13,
        });
      });

      test("mixed outdent capabilities (3, 2, 0 spaces)", () => {
        const text = "   line1\n  line2\nline3\n line4";
        // Select all
        const result = processEditorShortcuts(
          "Tab",
          true,
          false,
          false,
          false,
          0,
          text.length,
          text,
        );
        expect(result).toEqual({
          newValue: "line1\nline2\nline3\nline4",
          newStart: 0,
          newEnd: 23,
        });
      });
    });
  });

  describe("Other keys", () => {
    test("ignores random keys", () => {
      const result = processEditorShortcuts("A", false, false, false, false, 0, 0, "test");
      expect(result).toBeNull();
    });
  });
});
