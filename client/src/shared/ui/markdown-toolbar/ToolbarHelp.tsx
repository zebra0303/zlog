import { useState, useRef } from "react";
import { HelpCircle } from "lucide-react";
import { useI18n } from "@/shared/i18n";

export function ToolbarHelp() {
  const { t } = useI18n();
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  const helpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
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
            <p className="mb-2 font-semibold text-[var(--color-text)]">{t("editor_help_title")}</p>
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
                <code className="rounded bg-[var(--color-background)] px-1">[text](URL)</code>{" "}
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
  );
}
