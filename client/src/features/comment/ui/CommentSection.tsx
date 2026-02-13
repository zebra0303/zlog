import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Heart, Reply, Github, LogOut } from "lucide-react";
import { Button, Card, CardContent, Textarea, DefaultAvatar } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { timeAgo } from "@/shared/lib/formatDate";
import { useI18n } from "@/shared/i18n";
import type { CommentWithReplies, CreateCommentRequest } from "@zlog/shared";

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
  if (!id) { id = generateUUID(); localStorage.setItem("zlog_visitor_id", id); }
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
  const [providers, setProviders] = useState<{ github: boolean; google: boolean }>({ github: false, google: false });
  const [commenter, setCommenter] = useState<CommenterInfo | null>(getCommenter());
  const { t } = useI18n();

  const fetchComments = useCallback(() => {
    void api.get<CommentWithReplies[]>(`/posts/${postId}/comments?visitorId=${getVisitorId()}`).then((data) => { setComments(data); setIsLoading(false); }).catch(() => setIsLoading(false));
  }, [postId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);
  useEffect(() => {
    void api.get<{ github: boolean; google: boolean }>("/oauth/providers").then(setProviders).catch(() => {});
  }, []);

  const handleLogout = () => {
    clearCommenter();
    setCommenter(null);
  };

  return (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]"><MessageSquare className="h-5 w-5" />{t("comment_title")}</h3>

      {/* 로그인 상태 표시 */}
      {commenter ? (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2">
          <div className="flex items-center gap-2">
            {commenter.avatarUrl ? (
              <img src={commenter.avatarUrl} alt={commenter.displayName} className="h-6 w-6 rounded-full" />
            ) : (
              <DefaultAvatar size={24} />
            )}
            <span className="text-sm font-medium text-[var(--color-text)]">{commenter.displayName}</span>
            <span className="text-xs text-[var(--color-text-secondary)]">({commenter.provider})</span>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
            <LogOut className="h-3 w-3" />{t("comment_logout")}
          </button>
        </div>
      ) : (providers.github || providers.google) ? (
        <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-4">
          <p className="mb-3 text-sm text-[var(--color-text-secondary)]">{t("comment_login_prompt")}</p>
          <div className="flex flex-wrap gap-2">
            {providers.github && (
              <Button variant="outline" size="sm" onClick={() => {
                localStorage.setItem("zlog_oauth_return", window.location.href);
                window.location.href = "/api/oauth/github";
              }}>
                <Github className="mr-1 h-4 w-4" />{t("comment_login_github")}
              </Button>
            )}
            {providers.google && (
              <Button variant="outline" size="sm" onClick={() => {
                localStorage.setItem("zlog_oauth_return", window.location.href);
                window.location.href = "/api/oauth/google";
              }}>
                <GoogleIcon className="mr-1 h-4 w-4" />{t("comment_login_google")}
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {commenter ? (
        <CommentForm postId={postId} onSuccess={fetchComments} commenter={commenter} />
      ) : (
        !(providers.github || providers.google) && (
          <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">{t("comment_login_required")}</p>
          </div>
        )
      )}
      <div className="mt-6 flex flex-col gap-4">{comments.map((c) => <CommentThread key={c.id} comment={c} postId={postId} onRefresh={fetchComments} depth={0} commenter={commenter} />)}</div>
      {!isLoading && comments.length === 0 && <p className="mt-4 text-center text-sm text-[var(--color-text-secondary)]">{t("comment_no_comments")}</p>}
    </div>
  );
}

function CommentForm({ postId, parentId, onSuccess, onCancel, commenter }: { postId: string; parentId?: string; onSuccess: () => void; onCancel?: () => void; commenter: CommenterInfo | null }) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  if (!commenter) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); setError(null);
    try {
      const payload: Record<string, unknown> = {
        authorName: commenter.displayName,
        authorEmail: commenter.provider + "@oauth",
        authorAvatarUrl: commenter.avatarUrl || undefined,
        commenterId: commenter.commenterId || undefined,
        content,
        parentId,
      };
      await api.post(`/posts/${postId}/comments`, payload);
      setContent("");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("comment_write_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card><CardContent className="pt-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          {commenter.avatarUrl ? <img src={commenter.avatarUrl} alt="" className="h-5 w-5 rounded-full" /> : <DefaultAvatar size={20} />}
          <span>{commenter.displayName} {t("comment_writing_as")}</span>
        </div>
        <Textarea placeholder={t("comment_placeholder")} value={content} onChange={(e) => setContent(e.target.value)} required maxLength={2000} rows={3} />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          {onCancel && <Button variant="ghost" size="sm" type="button" onClick={onCancel}>{t("cancel")}</Button>}
          <Button size="sm" type="submit" disabled={isSubmitting}>{isSubmitting ? t("comment_submitting") : t("comment_submit")}</Button>
        </div>
      </form>
    </CardContent></Card>
  );
}

function CommentThread({ comment, postId, onRefresh, depth, commenter }: { comment: CommentWithReplies; postId: string; onRefresh: () => void; depth: number; commenter: CommenterInfo | null }) {
  const [showReply, setShowReply] = useState(false);
  const isDeleted = !!comment.deletedAt;
  const handleLike = async () => { try { await api.post(`/comments/${comment.id}/like`, { visitorId: getVisitorId() }); onRefresh(); } catch {} };
  const { t } = useI18n();

  const avatarUrl = comment.authorAvatarUrl;

  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-[var(--color-border)] pl-4" : ""}>
      <div className="flex gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt={comment.authorName} className="h-9 w-9 shrink-0 rounded-full" />
        ) : (
          <DefaultAvatar size={36} />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2"><span className="font-medium text-[var(--color-text)]">{isDeleted ? t("comment_deleted") : comment.authorName}</span><span className="text-xs text-[var(--color-text-secondary)]">{timeAgo(comment.createdAt)}</span></div>
          <p className={`mt-1 text-sm ${isDeleted ? "italic text-[var(--color-text-secondary)]" : "text-[var(--color-text)]"}`}>{comment.content}</p>
          {!isDeleted && (
            <div className="mt-2 flex items-center gap-3">
              <button onClick={handleLike} className={`flex items-center gap-1 text-xs transition-colors ${comment.isLikedByMe ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"}`}><Heart className={`h-3.5 w-3.5 ${comment.isLikedByMe ? "fill-current" : ""}`} />{comment.likeCount > 0 && comment.likeCount}</button>
              {depth < 2 && <button onClick={() => setShowReply(!showReply)} className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"><Reply className="h-3.5 w-3.5" />{t("comment_reply")}</button>}
            </div>
          )}
          {showReply && <div className="mt-3"><CommentForm postId={postId} parentId={comment.id} onSuccess={() => { setShowReply(false); onRefresh(); }} onCancel={() => setShowReply(false)} commenter={commenter} /></div>}
        </div>
      </div>
      {comment.replies.length > 0 && <div className="mt-3 flex flex-col gap-3">{comment.replies.map((r) => <CommentThread key={r.id} comment={r} postId={postId} onRefresh={onRefresh} depth={depth + 1} commenter={commenter} />)}</div>}
    </div>
  );
}
