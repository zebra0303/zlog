import { useCallback, useEffect, useRef, useState, useMemo, lazy, Suspense } from "react";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  Link,
  Image,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  FileCode,
  Minus,
  Palette,
  Table,
  Info,
  SmilePlus,
  Sticker,
  HelpCircle,
  Copy,
  Check,
  Undo2,
  Redo2,
} from "lucide-react";
import type { EmojiClickData, Theme } from "emoji-picker-react";
import { useI18n } from "../i18n";
import { useThemeStore } from "@/features/toggle-theme/model/store";

// Lazy-load pickers to keep them in separate chunks and reduce initial bundle size
const StickerPicker = lazy(() => import("./StickerPicker"));
const HexColorPicker = lazy(() =>
  import("react-colorful").then((m) => ({ default: m.HexColorPicker })),
);
const EmojiPicker = lazy(() => import("emoji-picker-react"));

// GIPHY API key from env — sticker button only renders when set
const giphyApiKey = (import.meta.env.VITE_GIPHY_API_KEY ?? "") as string;

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  onImageUpload?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

// Generate markdown table string with given rows and cols
function generateMarkdownTable(rows: number, cols: number): string {
  const header = Array.from({ length: cols }, (_, i) => ` Header ${i + 1} `).join("|");
  const separator = Array.from({ length: cols }, () => " --- ").join("|");
  const emptyRow = Array.from({ length: cols }, () => "  ").join("|");
  const dataRows = Array.from({ length: rows - 1 }, () => `|${emptyRow}|`).join("\n");
  return `|${header}|\n|${separator}|\n${dataRows}\n`;
}

const GRID_SIZE = 8;

// Preset colors for text/background color picker
const PRESET_COLORS_DARK = [
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#64748b",
];
const PRESET_COLORS_LIGHT = [
  "#fecaca",
  "#fed7aa",
  "#fef08a",
  "#bbf7d0",
  "#a5f3fc",
  "#bfdbfe",
  "#ddd6fe",
  "#e2e8f0",
];

export function MarkdownToolbar({
  textareaRef,
  value,
  onChange,
  onImageUpload,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: MarkdownToolbarProps) {
  const { t } = useI18n();
  const { isDark } = useThemeStore();

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

  // Buttons array — table removed, rendered separately below
  const buttons: {
    icon: React.ReactNode;
    label: string;
    action: () => void;
    disabled?: boolean;
  }[][] = [
    // Undo / Redo group
    [
      {
        icon: <Undo2 className="h-4 w-4" />,
        label: t("toolbar_undo"),
        action: () => onUndo?.(),
        disabled: !canUndo,
      },
      {
        icon: <Redo2 className="h-4 w-4" />,
        label: t("toolbar_redo"),
        action: () => onRedo?.(),
        disabled: !canRedo,
      },
    ],
    [
      {
        icon: <Bold className="h-4 w-4" />,
        label: t("toolbar_bold"),
        action: () => {
          applyWrap("**", "**", "bold");
        },
      },
      {
        icon: <Italic className="h-4 w-4" />,
        label: t("toolbar_italic"),
        action: () => {
          applyWrap("*", "*", "italic");
        },
      },
      {
        icon: <Strikethrough className="h-4 w-4" />,
        label: t("toolbar_strikethrough"),
        action: () => {
          applyWrap("~~", "~~", "strikethrough");
        },
      },
    ],
    [
      {
        icon: <Heading2 className="h-4 w-4" />,
        label: t("toolbar_h2"),
        action: () => {
          applyLinePrefix("## ");
        },
      },
      {
        icon: <Heading3 className="h-4 w-4" />,
        label: t("toolbar_h3"),
        action: () => {
          applyLinePrefix("### ");
        },
      },
    ],
    [
      {
        icon: <Link className="h-4 w-4" />,
        label: t("toolbar_link"),
        action: () => {
          applyWrap("[", "](url)", "link text");
        },
      },
      {
        icon: <Image className="h-4 w-4" />,
        label: t("toolbar_image"),
        action: () => {
          if (onImageUpload) {
            onImageUpload();
          } else {
            applyInsert("![alt](url?align=center&width=넓이&height=높이)\n");
          }
        },
      },
    ],
    // List group: bullet, numbered, task list
    [
      {
        icon: <List className="h-4 w-4" />,
        label: t("toolbar_bullet_list"),
        action: () => {
          applyLinePrefix("- ");
        },
      },
      {
        icon: <ListOrdered className="h-4 w-4" />,
        label: t("toolbar_numbered_list"),
        action: () => {
          applyLinePrefix("1. ");
        },
      },
      {
        icon: <ListTodo className="h-4 w-4" />,
        label: t("toolbar_task_list"),
        action: () => {
          applyLinePrefix("- [ ] ");
        },
      },
    ],
    // Block formatting: quote, inline code, code block
    [
      {
        icon: <Quote className="h-4 w-4" />,
        label: t("toolbar_quote"),
        action: () => {
          applyLinePrefix("> ");
        },
      },
      {
        icon: <Code className="h-4 w-4" />,
        label: t("toolbar_inline_code"),
        action: () => {
          applyWrap("`", "`", "code");
        },
      },
      {
        icon: <FileCode className="h-4 w-4" />,
        label: t("toolbar_code_block"),
        action: () => {
          applyWrap("```\n", "\n```", "code");
        },
      },
    ],
    [
      {
        icon: <Minus className="h-4 w-4" />,
        label: t("toolbar_hr"),
        action: () => {
          applyInsert("\n---\n");
        },
      },
    ],
  ];

  const calloutTypes = [
    { type: "NOTE", emoji: "\u2139\uFE0F", label: "Note" },
    { type: "TIP", emoji: "\uD83D\uDCA1", label: "Tip" },
    { type: "IMPORTANT", emoji: "\u2757", label: "Important" },
    { type: "WARNING", emoji: "\u26A0\uFE0F", label: "Warning" },
    { type: "CAUTION", emoji: "\uD83D\uDED1", label: "Caution" },
  ];

  const [calloutOpen, setCalloutOpen] = useState(false);
  const calloutRef = useRef<HTMLDivElement>(null);
  const calloutPopoverRef = useRef<HTMLDivElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  const helpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Emoji picker state
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const emojiPopoverRef = useRef<HTMLDivElement>(null);

  // Sticker picker state (only used when giphyApiKey is set)
  const [stickerOpen, setStickerOpen] = useState(false);
  const stickerRef = useRef<HTMLDivElement>(null);
  const stickerPopoverRef = useRef<HTMLDivElement>(null);

  // Color picker state
  const [colorOpen, setColorOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);
  const colorPopoverRef = useRef<HTMLDivElement>(null);
  const [colorMode, setColorMode] = useState<"text" | "bg">("text");
  const [customColor, setCustomColor] = useState("#dc2626");
  const [colorCopied, setColorCopied] = useState(false);

  // Table size picker state
  const [tableOpen, setTableOpen] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const tablePopoverRef = useRef<HTMLDivElement>(null);
  const [tableHover, setTableHover] = useState({ rows: 0, cols: 0 });
  const [tableInput, setTableInput] = useState({ rows: 3, cols: 3 });
  const [isTouchDevice] = useState(() => typeof window !== "undefined" && "ontouchstart" in window);

  // Close popovers on outside click
  const closeCallout = useMemo(
    () => () => {
      setCalloutOpen(false);
    },
    [],
  );
  const closeTable = useMemo(
    () => () => {
      setTableOpen(false);
    },
    [],
  );
  const closeEmoji = useMemo(
    () => () => {
      setEmojiOpen(false);
    },
    [],
  );
  const closeColor = useMemo(
    () => () => {
      setColorOpen(false);
    },
    [],
  );
  const closeSticker = useMemo(
    () => () => {
      setStickerOpen(false);
    },
    [],
  );
  useClickOutside(calloutRef, closeCallout, calloutOpen);
  useClickOutside(tableRef, closeTable, tableOpen);
  useClickOutside(emojiRef, closeEmoji, emojiOpen);
  useClickOutside(colorRef, closeColor, colorOpen);
  useClickOutside(stickerRef, closeSticker, stickerOpen);

  // Shared helper: position a popover within viewport bounds
  const alignPopover = useCallback(
    (popover: HTMLDivElement | null, wrapper: HTMLDivElement | null) => {
      if (!popover || !wrapper) return;
      // Reset to natural position before measuring
      popover.style.left = "auto";
      popover.style.right = "auto";
      requestAnimationFrame(() => {
        const wrapperRect = wrapper.getBoundingClientRect();
        const popoverWidth = popover.offsetWidth;
        const viewportWidth = document.documentElement.clientWidth;
        const gap = 8; // minimum distance from screen edge
        // Default: align left edge of popover with left edge of wrapper
        let left = 0;
        const popoverRight = wrapperRect.left + left + popoverWidth;
        // If overflows right, shift left
        if (popoverRight > viewportWidth - gap) {
          left = viewportWidth - gap - popoverWidth - wrapperRect.left;
        }
        // If overflows left after shift, clamp to left edge
        if (wrapperRect.left + left < gap) {
          left = gap - wrapperRect.left;
        }
        popover.style.left = `${left}px`;
      });
    },
    [],
  );

  // Position popovers when opened
  useEffect(() => {
    if (tableOpen) {
      alignPopover(tablePopoverRef.current, tableRef.current);
    }
  }, [tableOpen, alignPopover]);

  useEffect(() => {
    if (calloutOpen) {
      alignPopover(calloutPopoverRef.current, calloutRef.current);
    }
  }, [calloutOpen, alignPopover]);

  useEffect(() => {
    if (emojiOpen) {
      alignPopover(emojiPopoverRef.current, emojiRef.current);
    }
  }, [emojiOpen, alignPopover]);

  useEffect(() => {
    if (colorOpen) {
      alignPopover(colorPopoverRef.current, colorRef.current);
    }
  }, [colorOpen, alignPopover]);

  useEffect(() => {
    if (stickerOpen) {
      alignPopover(stickerPopoverRef.current, stickerRef.current);
    }
  }, [stickerOpen, alignPopover]);

  // Keyboard navigation for grid picker
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const { rows, cols } = tableHover;
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          setTableHover({ rows: rows || 1, cols: Math.min((cols || 0) + 1, GRID_SIZE) });
          break;
        case "ArrowLeft":
          e.preventDefault();
          setTableHover({ rows: rows || 1, cols: Math.max((cols || 1) - 1, 1) });
          break;
        case "ArrowDown":
          e.preventDefault();
          setTableHover({ rows: Math.min((rows || 0) + 1, GRID_SIZE), cols: cols || 1 });
          break;
        case "ArrowUp":
          e.preventDefault();
          setTableHover({ rows: Math.max((rows || 1) - 1, 1), cols: cols || 1 });
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (rows > 0 && cols > 0) {
            applyInsert(generateMarkdownTable(rows, cols));
            setTableOpen(false);
            setTableHover({ rows: 0, cols: 0 });
          }
          break;
        case "Escape":
          e.preventDefault();
          setTableOpen(false);
          setTableHover({ rows: 0, cols: 0 });
          break;
      }
    },
    [tableHover, applyInsert],
  );

  const onEmojiClick = (emojiData: EmojiClickData) => {
    applyInsert(emojiData.emoji);
    setEmojiOpen(false);
  };

  // Apply color wrap to selected text
  const applyColor = useCallback(
    (hex: string, mode: "text" | "bg") => {
      const style = mode === "text" ? `color:${hex}` : `background-color:${hex}`;
      applyWrap(`<span style="${style}">`, "</span>", "colored text");
      setColorOpen(false);
    },
    [applyWrap],
  );

  // Copy hex code to clipboard
  const copyHex = useCallback(async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setColorCopied(true);
      setTimeout(() => {
        setColorCopied(false);
      }, 1500);
    } catch {
      // Clipboard API may not be available
    }
  }, []);

  // Clamp helper for mobile number inputs
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  return (
    <div
      className="border-border bg-surface flex flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 px-2 py-1.5"
      role="toolbar"
      aria-label="Markdown formatting"
    >
      {/* eslint-disable-next-line react-hooks/refs */}
      {buttons.map((group, gi) => (
        <div key={gi} className="flex items-center">
          {gi > 0 && (
            <div className="bg-border mx-1 h-5 w-px" role="separator" aria-hidden="true" />
          )}
          {group.map((btn, bi) => (
            <button
              key={bi}
              type="button"
              title={btn.label}
              aria-label={btn.label}
              disabled={btn.disabled}
              onClick={btn.action}
              className={`rounded p-1.5 transition-colors ${
                btn.disabled
                  ? "cursor-not-allowed opacity-30"
                  : "text-text-secondary hover:text-text hover:bg-background"
              }`}
            >
              {btn.icon}
            </button>
          ))}
        </div>
      ))}

      {/* Color picker popover */}
      <div className="bg-border mx-1 h-5 w-px" role="separator" aria-hidden="true" />
      <div ref={colorRef} className="relative">
        <button
          type="button"
          title={t("toolbar_color")}
          aria-label={t("toolbar_color")}
          aria-expanded={colorOpen}
          aria-haspopup="true"
          onClick={() => {
            setColorOpen((prev) => !prev);
            setTableOpen(false);
            setCalloutOpen(false);
            setEmojiOpen(false);
            setStickerOpen(false);
          }}
          className="text-text-secondary hover:text-text hover:bg-background rounded p-1.5 transition-colors"
        >
          <Palette className="h-4 w-4" />
        </button>
        {colorOpen && (
          <div
            ref={colorPopoverRef}
            className="border-border bg-surface absolute top-full z-50 mt-1 rounded-lg border p-3 shadow-lg"
            style={{ minWidth: 220 }}
          >
            {/* Mode toggle tabs */}
            <div className="mb-2 flex gap-1 rounded-md bg-[var(--color-background)] p-0.5">
              <button
                type="button"
                className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  colorMode === "text"
                    ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
                onClick={() => {
                  setColorMode("text");
                }}
              >
                {t("toolbar_color_text")}
              </button>
              <button
                type="button"
                className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  colorMode === "bg"
                    ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
                onClick={() => {
                  setColorMode("bg");
                }}
              >
                {t("toolbar_color_bg")}
              </button>
            </div>

            {/* Preset colors — dark row */}
            <div className="mb-1 flex gap-1">
              {PRESET_COLORS_DARK.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className="h-5 w-5 rounded-sm border border-[var(--color-border)] transition-transform hover:scale-125"
                  style={{ backgroundColor: hex }}
                  aria-label={hex}
                  onClick={() => {
                    applyColor(hex, colorMode);
                  }}
                />
              ))}
            </div>
            {/* Preset colors — light row */}
            <div className="mb-2 flex gap-1">
              {PRESET_COLORS_LIGHT.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className="h-5 w-5 rounded-sm border border-[var(--color-border)] transition-transform hover:scale-125"
                  style={{ backgroundColor: hex }}
                  aria-label={hex}
                  onClick={() => {
                    applyColor(hex, colorMode);
                  }}
                />
              ))}
            </div>

            {/* Custom color picker */}
            <div className="border-border border-t pt-2">
              <Suspense
                fallback={
                  <div className="bg-surface text-text-secondary p-4 text-center text-sm">
                    Loading color picker...
                  </div>
                }
              >
                <HexColorPicker
                  color={customColor}
                  onChange={setCustomColor}
                  style={{ width: "100%" }}
                />
              </Suspense>
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  type="button"
                  className="bg-primary hover:bg-primary/90 flex-1 rounded px-2 py-1 text-xs text-white transition-colors"
                  onClick={() => {
                    applyColor(customColor, colorMode);
                  }}
                >
                  {colorMode === "text" ? t("toolbar_color_text") : t("toolbar_color_bg")}
                </button>
                <code className="text-text-secondary bg-background rounded px-1.5 py-1 text-xs">
                  {customColor}
                </code>
                <button
                  type="button"
                  title={t("toolbar_color_copy")}
                  aria-label={t("toolbar_color_copy")}
                  className="text-text-secondary hover:text-text rounded p-1 transition-colors"
                  onClick={() => copyHex(customColor)}
                >
                  {colorCopied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table size picker — separate from buttons array */}
      <div className="bg-border mx-1 h-5 w-px" role="separator" aria-hidden="true" />
      <div ref={tableRef} className="relative">
        <button
          type="button"
          title={t("toolbar_table")}
          aria-label={t("toolbar_table")}
          aria-expanded={tableOpen}
          aria-haspopup="true"
          onClick={() => {
            setTableOpen((prev) => !prev);
            setCalloutOpen(false);
            setEmojiOpen(false);
            setColorOpen(false);
            setStickerOpen(false);
          }}
          className="text-text-secondary hover:text-text hover:bg-background rounded p-1.5 transition-colors"
        >
          <Table className="h-4 w-4" />
        </button>
        {tableOpen && (
          <div
            ref={tablePopoverRef}
            className="border-border bg-surface absolute top-full z-50 mt-1 rounded-lg border p-2 shadow-lg"
            role="dialog"
            aria-label={t("toolbar_table_grid")}
          >
            {isTouchDevice ? (
              /* Mobile: number inputs for rows/cols */
              <div className="flex flex-col gap-2" style={{ minWidth: 160 }}>
                <label className="text-text-secondary flex items-center justify-between gap-2 text-xs">
                  {t("toolbar_table_rows")}
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={tableInput.rows}
                    onChange={(e) => {
                      setTableInput((prev) => ({
                        ...prev,
                        rows: clamp(Number(e.target.value) || 1, 1, 8),
                      }));
                    }}
                    className="border-border bg-background text-text w-14 rounded border px-1.5 py-0.5 text-sm"
                  />
                </label>
                <label className="text-text-secondary flex items-center justify-between gap-2 text-xs">
                  {t("toolbar_table_cols")}
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={tableInput.cols}
                    onChange={(e) => {
                      setTableInput((prev) => ({
                        ...prev,
                        cols: clamp(Number(e.target.value) || 1, 1, 8),
                      }));
                    }}
                    className="border-border bg-background text-text w-14 rounded border px-1.5 py-0.5 text-sm"
                  />
                </label>
                <div className="text-text-secondary text-center text-xs">
                  {tableInput.rows} &times; {tableInput.cols}
                </div>
                <button
                  type="button"
                  className="bg-primary hover:bg-primary/90 rounded px-2 py-1 text-sm text-white transition-colors"
                  onClick={() => {
                    applyInsert(generateMarkdownTable(tableInput.rows, tableInput.cols));
                    setTableOpen(false);
                  }}
                >
                  {t("toolbar_table_insert")}
                </button>
              </div>
            ) : (
              /* Desktop: 8x8 hover grid */
              <div>
                <div
                  className="grid gap-0.5"
                  style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
                  role="grid"
                  aria-label={t("toolbar_table_select_size")}
                  tabIndex={0}
                  onKeyDown={handleGridKeyDown}
                >
                  {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
                    const r = Math.floor(i / GRID_SIZE) + 1;
                    const c = (i % GRID_SIZE) + 1;
                    const highlighted = r <= tableHover.rows && c <= tableHover.cols;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`h-4 w-4 rounded-sm border transition-colors ${
                          highlighted
                            ? "bg-primary/30 border-primary"
                            : "border-border bg-background hover:border-text-secondary"
                        }`}
                        aria-label={`${r} × ${c}`}
                        onMouseEnter={() => {
                          setTableHover({ rows: r, cols: c });
                        }}
                        onClick={() => {
                          applyInsert(generateMarkdownTable(r, c));
                          setTableOpen(false);
                          setTableHover({ rows: 0, cols: 0 });
                        }}
                      />
                    );
                  })}
                </div>
                <div
                  className="text-text-secondary mt-1.5 text-center text-xs"
                  onMouseLeave={() => {
                    setTableHover({ rows: 0, cols: 0 });
                  }}
                >
                  {tableHover.rows > 0 && tableHover.cols > 0
                    ? `${tableHover.rows} × ${tableHover.cols}`
                    : t("toolbar_table_select_size")}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Callout popover */}
      <div ref={calloutRef} className="relative">
        <button
          type="button"
          title={t("toolbar_callout")}
          aria-label={t("toolbar_callout")}
          aria-expanded={calloutOpen}
          aria-haspopup="true"
          onClick={() => {
            setCalloutOpen((prev) => !prev);
            setTableOpen(false);
            setEmojiOpen(false);
            setColorOpen(false);
            setStickerOpen(false);
          }}
          className="text-text-secondary hover:text-text hover:bg-background rounded p-1.5 transition-colors"
        >
          <Info className="h-4 w-4" />
        </button>
        {calloutOpen && (
          <div
            ref={calloutPopoverRef}
            className="border-border bg-surface absolute top-full z-50 mt-1 min-w-40 rounded-lg border py-1 shadow-lg"
          >
            {calloutTypes.map((ct) => (
              <button
                key={ct.type}
                type="button"
                className="text-text hover:bg-background flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors"
                onClick={() => {
                  applyInsert(`> [!${ct.type}]\n> `);
                  setCalloutOpen(false);
                }}
              >
                <span className="w-5 text-center">{ct.emoji}</span>
                <span>{ct.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Emoji popover */}
      <div ref={emojiRef} className="relative">
        <button
          type="button"
          title={t("toolbar_emoji")}
          aria-label={t("toolbar_emoji")}
          aria-expanded={emojiOpen}
          aria-haspopup="true"
          onClick={() => {
            setEmojiOpen((prev) => !prev);
            setCalloutOpen(false);
            setTableOpen(false);
            setColorOpen(false);
            setStickerOpen(false);
          }}
          className="text-text-secondary hover:text-text hover:bg-background rounded p-1.5 transition-colors"
        >
          <SmilePlus className="h-4 w-4" />
        </button>
        {emojiOpen && (
          <div ref={emojiPopoverRef} className="absolute top-full z-50 mt-1 shadow-lg">
            <Suspense
              fallback={
                <div className="bg-surface text-text-secondary p-4 text-sm">Loading...</div>
              }
            >
              <EmojiPicker
                onEmojiClick={onEmojiClick}
                theme={(isDark ? "dark" : "light") as Theme}
                lazyLoadEmojis={true}
                searchDisabled={true}
                skinTonesDisabled={true}
              />
            </Suspense>
          </div>
        )}
      </div>

      {/* Sticker picker popover — only rendered when GIPHY API key is configured */}
      {giphyApiKey && (
        <div ref={stickerRef} className="relative">
          <button
            type="button"
            title={t("toolbar_sticker")}
            aria-label={t("toolbar_sticker")}
            aria-expanded={stickerOpen}
            aria-haspopup="true"
            onClick={() => {
              setStickerOpen((prev) => !prev);
              setEmojiOpen(false);
              setCalloutOpen(false);
              setTableOpen(false);
              setColorOpen(false);
            }}
            className="text-text-secondary hover:text-text hover:bg-background rounded p-1.5 transition-colors"
          >
            <Sticker className="h-4 w-4" />
          </button>
          {stickerOpen && (
            <div ref={stickerPopoverRef} className="absolute top-full z-50 mt-1">
              <Suspense
                fallback={
                  <div className="border-border bg-surface rounded-lg border p-4 text-center text-xs shadow-lg">
                    {t("loading")}
                  </div>
                }
              >
                <StickerPicker
                  apiKey={giphyApiKey}
                  isDark={isDark}
                  onSelect={(url) => {
                    applyInsert(`![sticker](${url}?align=center&width=180)\n`);
                    setStickerOpen(false);
                  }}
                />
              </Suspense>
            </div>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center">
        <div className="bg-border mx-1 h-5 w-px" role="separator" aria-hidden="true" />
        <div
          ref={helpRef}
          className="relative"
          onMouseEnter={() => {
            if (helpTimerRef.current) clearTimeout(helpTimerRef.current);
            setHelpOpen(true);
          }}
          onMouseLeave={() => {
            helpTimerRef.current = setTimeout(() => {
              setHelpOpen(false);
            }, 150);
          }}
        >
          <button
            type="button"
            aria-label="Editor help"
            className="text-text-secondary hover:text-text hover:bg-background rounded p-1.5 transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          {helpOpen && (
            <div className="border-border absolute top-full right-0 z-50 mt-1 w-72 rounded-lg border bg-[var(--color-surface)] p-3 text-xs text-[var(--color-text)] shadow-lg">
              <p className="mb-2 font-semibold text-[var(--color-text)]">
                {t("editor_help_title")}
              </p>
              <ul className="flex flex-col gap-2 text-[var(--color-text-secondary)]">
                <li>
                  <span className="font-medium text-[var(--color-text)]">
                    {t("editor_help_image_title")}
                  </span>
                  <br />
                  {t("editor_help_image_desc")}
                  <br />
                  <code className="mt-1 inline-block rounded bg-[var(--color-background)] px-1">
                    ![alt](url?width=100&height=200)
                  </code>{" "}
                  {t("editor_help_image_format")}
                </li>
                <li>
                  <span className="font-medium text-[var(--color-text)]">
                    {t("editor_help_youtube_title")}
                  </span>
                  <br />
                  {t("editor_help_youtube_desc")}
                </li>
                <li>
                  <span className="font-medium text-[var(--color-text)]">
                    {t("editor_help_link_title")}
                  </span>
                  <br />
                  <code className="rounded bg-[var(--color-background)] px-1">
                    [text](URL)
                  </code>{" "}
                  {t("editor_help_link_desc")}
                </li>
                <li>
                  <span className="font-medium text-[var(--color-text)]">
                    {t("editor_help_callout_title")}
                  </span>
                  <br />
                  <code className="rounded bg-[var(--color-background)] px-1">{`> [!NOTE]`}</code>{" "}
                  {t("editor_help_callout_desc")}
                </li>
                <li>
                  <span className="font-medium text-[var(--color-text)]">
                    {t("editor_help_code_title")}
                  </span>
                  <br />
                  <code className="rounded bg-[var(--color-background)] px-1">```js</code>{" "}
                  {t("editor_help_code_desc")}
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
