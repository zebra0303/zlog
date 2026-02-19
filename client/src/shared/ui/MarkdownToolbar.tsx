import { useCallback, useEffect, useRef, useState } from "react";
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
  Quote,
  Code,
  FileCode,
  Minus,
  Table,
  Info,
  HelpCircle,
} from "lucide-react";
import { useI18n } from "../i18n";

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  onImageUpload?: () => void;
}

export function MarkdownToolbar({
  textareaRef,
  value,
  onChange,
  onImageUpload,
}: MarkdownToolbarProps) {
  const { t } = useI18n();

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

  const buttons: { icon: React.ReactNode; label: string; action: () => void }[][] = [
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
            applyInsert("![alt](url)\n");
          }
        },
      },
    ],
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
        icon: <Quote className="h-4 w-4" />,
        label: t("toolbar_quote"),
        action: () => {
          applyLinePrefix("> ");
        },
      },
    ],
    [
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
      {
        icon: <Table className="h-4 w-4" />,
        label: t("toolbar_table"),
        action: () => {
          applyInsert(
            "| Column 1 | Column 2 |\n| -------- | -------- |\n| Cell     | Cell     |\n",
          );
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
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  const helpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!calloutOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (calloutRef.current && !calloutRef.current.contains(e.target as Node)) {
        setCalloutOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [calloutOpen]);

  return (
    <div
      className="border-border bg-surface flex flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 px-2 py-1.5"
      role="toolbar"
      aria-label="Markdown formatting"
    >
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
              onClick={btn.action}
              className="text-text-secondary hover:text-text hover:bg-background rounded p-1.5 transition-colors"
            >
              {btn.icon}
            </button>
          ))}
        </div>
      ))}
      <div className="bg-border mx-1 h-5 w-px" role="separator" aria-hidden="true" />
      <div ref={calloutRef} className="relative">
        <button
          type="button"
          title={t("toolbar_callout")}
          aria-label={t("toolbar_callout")}
          aria-expanded={calloutOpen}
          aria-haspopup="true"
          onClick={() => {
            setCalloutOpen((prev) => !prev);
          }}
          className="text-text-secondary hover:text-text hover:bg-background rounded p-1.5 transition-colors"
        >
          <Info className="h-4 w-4" />
        </button>
        {calloutOpen && (
          <div className="border-border bg-surface absolute top-full left-0 z-50 mt-1 min-w-40 rounded-lg border py-1 shadow-lg">
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
            <div className="border-border absolute top-full right-0 z-50 mt-1 w-72 rounded-lg border bg-[var(--color-background)] p-3 text-xs text-[var(--color-text)] shadow-lg">
              <p className="mb-2 font-semibold text-[var(--color-text)]">에디터 사용 안내</p>
              <ul className="flex flex-col gap-2 text-[var(--color-text-secondary)]">
                <li>
                  <span className="font-medium text-[var(--color-text)]">📎 이미지 업로드</span>
                  <br />
                  이미지 아이콘 클릭 또는 에디터 영역으로 드래그&amp;드롭
                </li>
                <li>
                  <span className="font-medium text-[var(--color-text)]">
                    ▶ YouTube 자동 임베드
                  </span>
                  <br />
                  YouTube URL을 단독 줄에 입력하면 동영상으로 자동 변환
                </li>
                <li>
                  <span className="font-medium text-[var(--color-text)]">🔗 링크</span>
                  <br />
                  <code className="rounded bg-[var(--color-background)] px-1">
                    [텍스트](URL)
                  </code>{" "}
                  또는 텍스트 선택 후 링크 아이콘 클릭
                </li>
                <li>
                  <span className="font-medium text-[var(--color-text)]">💬 콜아웃</span>
                  <br />
                  <code className="rounded bg-[var(--color-background)] px-1">{`> [!NOTE]`}</code>{" "}
                  형식. NOTE · TIP · WARNING 등 지원
                </li>
                <li>
                  <span className="font-medium text-[var(--color-text)]">💻 코드 블록</span>
                  <br />
                  <code className="rounded bg-[var(--color-background)] px-1">```js</code> 처럼
                  언어명 입력 시 신택스 하이라이팅 지원
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
