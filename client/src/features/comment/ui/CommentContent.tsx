import { useState } from "react";
import { useI18n } from "@/shared/i18n";

interface CommentContentProps {
  content: string;
  isDeleted: boolean;
}

export function CommentContent({ content, isDeleted }: CommentContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useI18n();
  const maxLength = 300;
  const maxLines = 5;

  const lines = content.split("\n");
  const needsExpansion = content.length > maxLength || lines.length > maxLines;

  let displayContent = content;
  if (needsExpansion && !isExpanded) {
    if (lines.length > maxLines) {
      displayContent = lines.slice(0, maxLines).join("\n");
      if (displayContent.length > maxLength) {
        displayContent = displayContent.slice(0, maxLength);
      }
    } else {
      displayContent = content.slice(0, maxLength);
    }
  }

  return (
    <div className="mt-1">
      <p
        className={`text-sm break-words whitespace-pre-wrap ${isDeleted ? "text-[var(--color-text-secondary)] italic" : "text-[var(--color-text)]"}`}
      >
        {displayContent}
        {needsExpansion && !isExpanded && "..."}
      </p>
      {needsExpansion && (
        <button
          onClick={() => {
            setIsExpanded(!isExpanded);
          }}
          className="mt-1 text-xs text-[var(--color-primary)] hover:underline focus:outline-none"
        >
          {isExpanded ? t("comment_show_less") || "접기" : t("comment_show_more") || "더 보기"}
        </button>
      )}
    </div>
  );
}
