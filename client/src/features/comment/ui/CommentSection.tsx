import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Link2, LogOut } from "lucide-react";
import { Button, DefaultAvatar } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";
import { useAuthStore } from "@/features/auth/model/store";
import { getVisitorId } from "@/shared/lib/visitorId";
import type { CommentWithReplies, PaginatedResponse } from "@zlog/shared";
import { CommentForm } from "./CommentForm";
import { CommentThread } from "./CommentThread";
import { hasVisibleComments, getCommenter, clearCommenter, GoogleIcon } from "./helpers";
import type { CommenterInfo } from "./types";

export function CommentSection({
  postId,
  onCountChange,
}: {
  postId: string;
  onCountChange?: (delta: number) => void;
}) {
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [providers, setProviders] = useState<{ github: boolean; google: boolean }>({
    github: false,
    google: false,
  });
  const [commenter, setCommenter] = useState<CommenterInfo | null>(getCommenter());
  const { t } = useI18n();
  const commentMode = useSiteSettingsStore((s) => s.settings.comment_mode) ?? "sso_only";
  const isAdmin = useAuthStore((s) => s.isAuthenticated);

  const fetchComments = useCallback(
    (currentPage = 1, isRefresh = false) => {
      void api
        .get<PaginatedResponse<CommentWithReplies> | CommentWithReplies[]>(
          `/posts/${postId}/comments?visitorId=${getVisitorId()}&page=${currentPage}`,
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
        .catch(() => {
          setIsLoading(false);
        });
    },
    [postId],
  );

  useEffect(() => {
    fetchComments(1, true);
  }, [fetchComments]);
  useEffect(() => {
    void api
      .get<{ github: boolean; google: boolean }>("/oauth/providers")
      .then(setProviders)
      .catch(() => {
        setProviders({ github: false, google: false });
      });
  }, []);

  const handleLogout = () => {
    clearCommenter();
    setCommenter(null);
  };

  if (commentMode === "disabled") {
    return (
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
          <MessageSquare className="h-5 w-5" />
          {t("comment_title")}
        </h3>
        <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
          {t("comment_disabled")}
        </p>
      </div>
    );
  }

  const hasProviders = providers.github || providers.google;
  const allowAnonymous = commentMode === "all" || commentMode === "anonymous_only";
  const showSsoLogin = commentMode !== "anonymous_only";

  return (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
        <MessageSquare className="h-5 w-5" />
        {t("comment_title")}
      </h3>

      {/* SSO login status display (hidden in anonymous_only mode) */}
      {showSsoLogin && commenter ? (
        <div
          className="mb-4 flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2"
          data-print-hide
        >
          <div className="flex items-center gap-2">
            {commenter.avatarUrl ? (
              <img
                src={commenter.avatarUrl}
                alt={commenter.displayName}
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <DefaultAvatar size={24} />
            )}
            <span className="text-sm font-medium text-[var(--color-text)]">
              {commenter.displayName}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">
              ({commenter.provider})
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            <LogOut className="h-3 w-3" />
            {t("comment_logout")}
          </button>
        </div>
      ) : showSsoLogin && hasProviders ? (
        <div
          className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          data-print-hide
        >
          <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
            {t("comment_login_prompt")}
          </p>
          <div className="flex flex-wrap gap-2">
            {providers.github && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.setItem("zlog_oauth_return", window.location.href);
                  window.location.href = "/api/oauth/github";
                }}
              >
                <Link2 className="mr-1 h-4 w-4" />
                {t("comment_login_github")}
              </Button>
            )}
            {providers.google && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.setItem("zlog_oauth_return", window.location.href);
                  window.location.href = "/api/oauth/google";
                }}
              >
                <GoogleIcon className="mr-1 h-4 w-4" />
                {t("comment_login_google")}
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {/* Comment form */}
      {showSsoLogin && commenter ? (
        <CommentForm
          postId={postId}
          onSuccess={() => {
            fetchComments(1, true);
          }}
          commenter={commenter}
          allowAnonymous={false}
          onCountChange={onCountChange}
        />
      ) : allowAnonymous ? (
        <CommentForm
          postId={postId}
          onSuccess={() => {
            fetchComments(1, true);
          }}
          commenter={null}
          allowAnonymous={true}
          onCountChange={onCountChange}
        />
      ) : showSsoLogin && !hasProviders ? (
        <div
          className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center"
          data-print-hide
        >
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("comment_login_required")}
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-4">
        {comments.filter(hasVisibleComments).map((c) => (
          <CommentThread
            key={c.id}
            comment={c}
            postId={postId}
            onRefresh={() => {
              fetchComments(1, true);
            }}
            depth={0}
            commenter={commenter}
            allowAnonymous={allowAnonymous}
            isAdmin={isAdmin}
            onCountChange={onCountChange}
          />
        ))}
      </div>
      {!isLoading && comments.filter(hasVisibleComments).length === 0 && (
        <p className="mt-4 text-center text-sm text-[var(--color-text-secondary)]">
          {t("comment_no_comments")}
        </p>
      )}
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
    </div>
  );
}
