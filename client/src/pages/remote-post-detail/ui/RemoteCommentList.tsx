import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Heart } from "lucide-react";
import { DefaultAvatar, Skeleton, Button } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { timeAgo } from "@/shared/lib/formatDate";
import { useI18n } from "@/shared/i18n";
import { getErrorMessage } from "@/shared/lib/getErrorMessage";
import type { CommentWithReplies, PaginatedResponse } from "@zlog/shared";

function hasVisibleComments(comment: CommentWithReplies): boolean {
  if (!comment.deletedAt) return true;
  return comment.replies.some(hasVisibleComments);
}

function CommentContent({ content, isDeleted }: { content: string; isDeleted: boolean }) {
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

function RemoteCommentThread({ comment, depth }: { comment: CommentWithReplies; depth: number }) {
  const isDeleted = !!comment.deletedAt;
  const avatarUrl = comment.authorAvatarUrl;

  return (
    <article
      className={depth > 0 ? "mt-3 ml-6 border-l-2 border-[var(--color-border)] pl-4" : "mt-6"}
    >
      <div className="flex gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt={comment.authorName} className="h-9 w-9 shrink-0 rounded-full" />
        ) : (
          <DefaultAvatar size={36} />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[var(--color-text)]">
              {isDeleted ? "삭제된 댓글입니다" : comment.authorName}
            </span>
            {comment.isEdited && !isDeleted && (
              <span className="text-xs text-[var(--color-text-secondary)]">(수정됨)</span>
            )}
            <span className="text-xs text-[var(--color-text-secondary)]">
              {timeAgo(comment.createdAt)}
            </span>
          </div>

          <CommentContent content={comment.content} isDeleted={isDeleted} />

          {!isDeleted && comment.likeCount > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
              <Heart className="h-3.5 w-3.5" />
              {comment.likeCount}
            </div>
          )}
        </div>
      </div>
      {comment.replies.filter(hasVisibleComments).length > 0 && (
        <div className="flex flex-col">
          {comment.replies.filter(hasVisibleComments).map((r) => (
            <RemoteCommentThread key={r.id} comment={r} depth={depth + 1} />
          ))}
        </div>
      )}
    </article>
  );
}

export function RemoteCommentList({ remotePostId }: { remotePostId: string }) {
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const { t } = useI18n();

  const fetchComments = useCallback(
    (currentPage = 1, isRefresh = false) => {
      void api
        .get<PaginatedResponse<CommentWithReplies> | CommentWithReplies[]>(
          `/federation/remote-posts/${remotePostId}/comments?page=${currentPage}`,
        )
        .then((data) => {
          if (Array.isArray(data)) {
            // Backward compatibility
            setComments(data);
            setHasMore(false);
          } else {
            setComments((prev) => (isRefresh ? data.items : [...prev, ...data.items]));
            setHasMore(data.page < data.totalPages);
            setPage(data.page);
          }
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          setError(getErrorMessage(err, "Failed to load comments"));
          setIsLoading(false);
        });
    },
    [remotePostId],
  );

  useEffect(() => {
    fetchComments(1, true);
  }, [fetchComments]);

  return (
    <div className="mt-8 border-t border-[var(--color-border)] pt-8">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
        <MessageSquare className="h-5 w-5" />
        {t("comment_title")}
        <span className="ml-2 text-sm font-normal text-[var(--color-text-secondary)]">
          (읽기 전용)
        </span>
      </h3>

      {isLoading && comments.length === 0 ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : error ? (
        <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
          원격 서버에서 댓글을 불러오지 못했습니다.
        </p>
      ) : comments.filter(hasVisibleComments).length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
          {t("comment_no_comments")}
        </p>
      ) : (
        <>
          <div className="flex flex-col">
            {comments.filter(hasVisibleComments).map((c) => (
              <RemoteCommentThread key={c.id} comment={c} depth={0} />
            ))}
          </div>
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  fetchComments(page + 1, false);
                }}
                disabled={isLoading}
              >
                {isLoading ? "..." : t("comment_load_more") || "더보기"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
