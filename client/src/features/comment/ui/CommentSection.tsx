import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Heart, Reply, Link2, LogOut, Pencil, Trash2 } from "lucide-react";
import { Button, Card, CardContent, Input, Textarea, DefaultAvatar } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { timeAgo } from "@/shared/lib/formatDate";
import { useI18n } from "@/shared/i18n";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";
import { useAuthStore } from "@/features/auth/model/store";
import type { CommentWithReplies } from "@zlog/shared";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getVisitorId(): string {
  let id = localStorage.getItem("zlog_visitor_id");
  if (!id) {
    id = generateUUID();
    localStorage.setItem("zlog_visitor_id", id);
  }
  return id;
}

interface CommenterInfo {
  commenterId: string;
  displayName: string;
  avatarUrl: string;
  provider: string;
}

function getCommenter(): CommenterInfo | null {
  try {
    const raw = localStorage.getItem("zlog_commenter");
    if (!raw) return null;
    return JSON.parse(raw) as CommenterInfo;
  } catch {
    return null;
  }
}

function clearCommenter() {
  localStorage.removeItem("zlog_commenter");
}

// Google SVG icon component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export function CommentSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [providers, setProviders] = useState<{ github: boolean; google: boolean }>({
    github: false,
    google: false,
  });
  const [commenter, setCommenter] = useState<CommenterInfo | null>(getCommenter());
  const { t } = useI18n();
  const commentMode = useSiteSettingsStore((s) => s.settings.comment_mode) ?? "sso_only";
  const isAdmin = useAuthStore((s) => s.isAuthenticated);

  const fetchComments = useCallback(() => {
    void api
      .get<CommentWithReplies[]>(`/posts/${postId}/comments?visitorId=${getVisitorId()}`)
      .then((data) => {
        setComments(data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [postId]);

  useEffect(() => {
    fetchComments();
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

      {/* SSO 로그인 상태 표시 (anonymous_only 모드에서는 숨김) */}
      {showSsoLogin && commenter ? (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2">
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
        <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-4">
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

      {/* 댓글 작성 폼 */}
      {showSsoLogin && commenter ? (
        <CommentForm
          postId={postId}
          onSuccess={fetchComments}
          commenter={commenter}
          allowAnonymous={false}
        />
      ) : allowAnonymous ? (
        <CommentForm
          postId={postId}
          onSuccess={fetchComments}
          commenter={null}
          allowAnonymous={true}
        />
      ) : showSsoLogin && !hasProviders ? (
        <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("comment_login_required")}
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-4">
        {comments.map((c) => (
          <CommentThread
            key={c.id}
            comment={c}
            postId={postId}
            onRefresh={fetchComments}
            depth={0}
            commenter={commenter}
            allowAnonymous={allowAnonymous}
            isAdmin={isAdmin}
          />
        ))}
      </div>
      {!isLoading && comments.length === 0 && (
        <p className="mt-4 text-center text-sm text-[var(--color-text-secondary)]">
          {t("comment_no_comments")}
        </p>
      )}
    </div>
  );
}

function CommentForm({
  postId,
  parentId,
  onSuccess,
  onCancel,
  commenter,
  allowAnonymous,
}: {
  postId: string;
  parentId?: string;
  onSuccess: () => void;
  onCancel?: () => void;
  commenter: CommenterInfo | null;
  allowAnonymous: boolean;
}) {
  const [content, setContent] = useState("");
  const [anonName, setAnonName] = useState("");
  const [anonEmail, setAnonEmail] = useState("");
  const [anonPassword, setAnonPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  // SSO only mode but no commenter → no form
  if (!commenter && !allowAnonymous) return null;

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = commenter
        ? {
            authorName: commenter.displayName,
            authorEmail: commenter.provider + "@oauth",
            authorAvatarUrl: commenter.avatarUrl,
            commenterId: commenter.commenterId,
            content,
            parentId,
          }
        : {
            authorName: anonName,
            authorEmail: anonEmail.length > 0 ? anonEmail : "anonymous@guest",
            password: anonPassword,
            content,
            parentId,
          };
      await api.post(`/posts/${postId}/comments`, payload);
      setContent("");
      if (!commenter) {
        setAnonName("");
        setAnonEmail("");
        setAnonPassword("");
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("comment_write_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {commenter ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              {commenter.avatarUrl ? (
                <img src={commenter.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
              ) : (
                <DefaultAvatar size={20} />
              )}
              <span>
                {commenter.displayName} {t("comment_writing_as")}
              </span>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                placeholder={t("comment_name_placeholder")}
                value={anonName}
                onChange={(e) => {
                  setAnonName(e.target.value);
                }}
                required
              />
              <Input
                placeholder={t("comment_email_placeholder")}
                type="email"
                value={anonEmail}
                onChange={(e) => {
                  setAnonEmail(e.target.value);
                }}
              />
              <Input
                placeholder={t("comment_password_placeholder")}
                type="password"
                value={anonPassword}
                onChange={(e) => {
                  setAnonPassword(e.target.value);
                }}
                required
              />
            </div>
          )}
          <Textarea
            placeholder={t("comment_placeholder")}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
            }}
            required
            maxLength={2000}
            rows={3}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
                {t("cancel")}
              </Button>
            )}
            <Button size="sm" type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("comment_submitting") : t("comment_submit")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function CommentThread({
  comment,
  postId,
  onRefresh,
  depth,
  commenter,
  allowAnonymous,
  isAdmin,
}: {
  comment: CommentWithReplies;
  postId: string;
  onRefresh: () => void;
  depth: number;
  commenter: CommenterInfo | null;
  allowAnonymous: boolean;
  isAdmin: boolean;
}) {
  const [showReply, setShowReply] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [editPassword, setEditPassword] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const isDeleted = !!comment.deletedAt;
  const handleLike = async () => {
    try {
      await api.post(`/comments/${comment.id}/like`, { visitorId: getVisitorId() });
      onRefresh();
    } catch {
      return;
    }
  };
  const { t } = useI18n();

  const avatarUrl = comment.authorAvatarUrl;

  // 수정 가능 여부: SSO 본인 또는 익명(hasPassword)
  const isSsoOwner = Boolean(
    commenter?.commenterId && commenter.commenterId === comment.commenterId,
  );
  const isAnonComment = !comment.commenterId && comment.hasPassword;
  const canEdit = !isDeleted && (isSsoOwner || isAnonComment);
  // 삭제 가능 여부: 관리자 또는 SSO 본인 또는 익명(hasPassword)
  const canDelete = !isDeleted && (isAdmin || isSsoOwner || isAnonComment);

  const handleEdit = async () => {
    setIsEditSubmitting(true);
    setEditError(null);
    try {
      const payload: Record<string, unknown> = { content: editContent };
      if (isSsoOwner) {
        payload.commenterId = commenter?.commenterId;
      } else if (isAnonComment) {
        payload.password = editPassword;
      }
      await api.put(`/comments/${comment.id}`, payload);
      setIsEditing(false);
      setEditPassword("");
      onRefresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t("comment_edit_wrong_password"));
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleDelete = async (password?: string) => {
    const payload: Record<string, unknown> = {};
    if (isSsoOwner) {
      payload.commenterId = commenter?.commenterId;
    } else if (isAnonComment && password) {
      payload.password = password;
    }
    // 관리자는 body 비워도 됨 (JWT 토큰으로 인증)

    try {
      await api.delete(`/comments/${comment.id}`, payload);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("comment_edit_wrong_password"));
    }
  };

  const onDeleteClick = () => {
    if (isAdmin || isSsoOwner) {
      // 관리자 또는 SSO 본인: confirm 다이얼로그
      if (window.confirm(t("comment_delete_confirm"))) {
        void handleDelete();
      }
    } else if (isAnonComment) {
      // 익명 댓글: 비밀번호 입력 표시
      setShowDeletePassword(true);
    }
  };

  const onDeletePasswordSubmit = () => {
    if (!deletePassword) return;
    if (window.confirm(t("comment_delete_confirm"))) {
      void handleDelete(deletePassword);
      setShowDeletePassword(false);
      setDeletePassword("");
    }
  };

  const onEditClick = () => {
    if (isSsoOwner) {
      setIsEditing(true);
      setEditContent(comment.content);
    } else if (isAnonComment) {
      // 익명: 비밀번호 필요 - 수정 모드 진입
      setIsEditing(true);
      setEditContent(comment.content);
    }
  };

  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-[var(--color-border)] pl-4" : ""}>
      <div className="flex gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt={comment.authorName} className="h-9 w-9 shrink-0 rounded-full" />
        ) : (
          <DefaultAvatar size={36} />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[var(--color-text)]">
              {isDeleted ? t("comment_deleted") : comment.authorName}
            </span>
            {comment.isEdited && !isDeleted && (
              <span className="text-xs text-[var(--color-text-secondary)]">
                {t("comment_edited")}
              </span>
            )}
            <span className="text-xs text-[var(--color-text-secondary)]">
              {timeAgo(comment.createdAt)}
            </span>
          </div>

          {isEditing && !isDeleted ? (
            <div className="mt-2 flex flex-col gap-2">
              <Textarea
                value={editContent}
                onChange={(e) => {
                  setEditContent(e.target.value);
                }}
                maxLength={2000}
                rows={3}
              />
              {isAnonComment && !isSsoOwner && (
                <Input
                  type="password"
                  placeholder={t("comment_edit_password_prompt")}
                  value={editPassword}
                  onChange={(e) => {
                    setEditPassword(e.target.value);
                  }}
                />
              )}
              {editError && <p className="text-xs text-red-500">{editError}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleEdit} disabled={isEditSubmitting}>
                  {isEditSubmitting ? "..." : t("comment_edit_save")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setEditError(null);
                    setEditPassword("");
                  }}
                >
                  {t("cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <p
              className={`mt-1 text-sm ${isDeleted ? "text-[var(--color-text-secondary)] italic" : "text-[var(--color-text)]"}`}
            >
              {comment.content}
            </p>
          )}

          {!isDeleted && !isEditing && (
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={handleLike}
                className={`flex items-center gap-1 text-xs transition-colors ${comment.isLikedByMe ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"}`}
              >
                <Heart className={`h-3.5 w-3.5 ${comment.isLikedByMe ? "fill-current" : ""}`} />
                {comment.likeCount > 0 && comment.likeCount}
              </button>
              {depth < 2 && (
                <button
                  onClick={() => {
                    setShowReply(!showReply);
                  }}
                  className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
                >
                  <Reply className="h-3.5 w-3.5" />
                  {t("comment_reply")}
                </button>
              )}
              {canEdit && (
                <button
                  onClick={onEditClick}
                  className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t("comment_edit")}
                </button>
              )}
              {canDelete && (
                <button
                  onClick={onDeleteClick}
                  className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("comment_delete")}
                </button>
              )}
            </div>
          )}

          {/* 익명 댓글 삭제 비밀번호 입력 */}
          {showDeletePassword && (
            <div className="mt-2 flex items-center gap-2">
              <Input
                type="password"
                placeholder={t("comment_delete_password_prompt")}
                value={deletePassword}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                }}
                className="max-w-xs"
              />
              <Button size="sm" onClick={onDeletePasswordSubmit}>
                {t("comment_delete")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowDeletePassword(false);
                  setDeletePassword("");
                }}
              >
                {t("cancel")}
              </Button>
            </div>
          )}

          {showReply && (
            <div className="mt-3">
              <CommentForm
                postId={postId}
                parentId={comment.id}
                onSuccess={() => {
                  setShowReply(false);
                  onRefresh();
                }}
                onCancel={() => {
                  setShowReply(false);
                }}
                commenter={commenter}
                allowAnonymous={allowAnonymous}
              />
            </div>
          )}
        </div>
      </div>
      {comment.replies.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {comment.replies.map((r) => (
            <CommentThread
              key={r.id}
              comment={r}
              postId={postId}
              onRefresh={onRefresh}
              depth={depth + 1}
              commenter={commenter}
              allowAnonymous={allowAnonymous}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
