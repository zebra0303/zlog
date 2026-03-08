import { useState } from "react";
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
  Undo2,
  Redo2,
} from "lucide-react";
import { useI18n } from "../i18n";
import { useMarkdownActions } from "../hooks/useMarkdownActions";
import {
  ColorPicker,
  TablePicker,
  CalloutPicker,
  EmojiPickerWrapper,
  StickerPickerWrapper,
  ToolbarHelp,
} from "./markdown-toolbar";

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

type PickerType = "color" | "table" | "callout" | "emoji" | "sticker" | null;

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
  const { applyWrap, applyLinePrefix, applyInsert } = useMarkdownActions({
    textareaRef,
    value,
    onChange,
  });

  const [activePicker, setActivePicker] = useState<PickerType>(null);

  const togglePicker = (picker: PickerType) => {
    setActivePicker((prev) => (prev === picker ? null : picker));
  };

  const closePicker = () => {
    setActivePicker(null);
  };

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

  return (
    <div
      className="border-border bg-surface flex flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 px-2 py-1.5"
      role="toolbar"
      aria-label="Markdown formatting"
    >
      {}
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

      <div className="bg-border mx-1 h-5 w-px" role="separator" aria-hidden="true" />
      <ColorPicker
        isOpen={activePicker === "color"}
        onToggle={() => {
          togglePicker("color");
        }}
        onClose={closePicker}
        applyWrap={applyWrap}
      />

      <div className="bg-border mx-1 h-5 w-px" role="separator" aria-hidden="true" />
      <TablePicker
        isOpen={activePicker === "table"}
        onToggle={() => {
          togglePicker("table");
        }}
        onClose={closePicker}
        applyInsert={applyInsert}
      />

      <CalloutPicker
        isOpen={activePicker === "callout"}
        onToggle={() => {
          togglePicker("callout");
        }}
        onClose={closePicker}
        applyInsert={applyInsert}
      />

      <EmojiPickerWrapper
        isOpen={activePicker === "emoji"}
        onToggle={() => {
          togglePicker("emoji");
        }}
        onClose={closePicker}
        applyInsert={applyInsert}
      />

      <StickerPickerWrapper
        isOpen={activePicker === "sticker"}
        onToggle={() => {
          togglePicker("sticker");
        }}
        onClose={closePicker}
        applyInsert={applyInsert}
      />

      <ToolbarHelp />
    </div>
  );
}
