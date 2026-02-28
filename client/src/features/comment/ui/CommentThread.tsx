import { useState } from "react";
import { Heart, Reply, Pencil, Trash2 } from "lucide-react";
import { Button, Input, Textarea, DefaultAvatar, useToast, useConfirm } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { timeAgo } from "@/shared/lib/formatDate";
import { useI18n } from "@/shared/i18n";
import { getVisitorId } from "@/shared/lib/visitorId";
import { getErrorMessage } from "@/shared/lib/getErrorMessage";
import type { CommentWithReplies } from "@zlog/shared";
import { CommentContent } from "./CommentContent";
import { CommentForm } from "./CommentForm";
import { hasVisibleComments } from "./helpers";
import type { CommenterInfo } from "./types";

interface CommentThreadProps {
  comment: CommentWithReplies;
  postId: string;
  onRefresh: () => void;
  depth: number;
  commenter: CommenterInfo | null;
  allowAnonymous: boolean;
  isAdmin: boolean;
  onCountChange?: (delta: number) => void;
}

export function CommentThread({
  comment,
  postId,
  onRefresh,
  depth,
  commenter,
  allowAnonymous,
  isAdmin,
  onCountChange,
}: CommentThreadProps) {
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
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const avatarUrl = comment.authorAvatarUrl;

  // Editable: SSO owner or anonymous (hasPassword)
  const isSsoOwner = Boolean(
    commenter?.commenterId && commenter.commenterId === comment.commenterId,
  );
  const isAnonComment = !comment.commenterId && comment.hasPassword;
  const canEdit = !isDeleted && (isSsoOwner || isAnonComment);
  // Deletable: admin or SSO owner or anonymous (hasPassword)
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
      setEditError(getErrorMessage(err, t("comment_edit_wrong_password")));
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
    // Admin can leave body empty (authenticated via JWT token)

    try {
      await api.delete(`/comments/${comment.id}`, payload);
      onCountChange?.(-1);
      onRefresh();
    } catch (err) {
      showToast(getErrorMessage(err, t("comment_edit_wrong_password")), "error");
    }
  };

  const onDeleteClick = async () => {
    if (isAdmin || isSsoOwner) {
      // Admin or SSO owner: confirm dialog
      const isConfirmed = await confirm(t("comment_delete_confirm"));
      if (isConfirmed) {
        void handleDelete();
      }
    } else if (isAnonComment) {
      // Anonymous comment: show password input
      setShowDeletePassword(true);
    }
  };

  const onDeletePasswordSubmit = async () => {
    if (!deletePassword) return;
    const isConfirmed = await confirm(t("comment_delete_confirm"));
    if (isConfirmed) {
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
      // Anonymous: password required - enter edit mode
      setIsEditing(true);
      setEditContent(comment.content);
    }
  };

  return (
    <article className={depth > 0 ? "ml-6 border-l-2 border-[var(--color-border)] pl-4" : ""}>
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
              {editError && <p className="text-xs text-[var(--color-destructive)]">{editError}</p>}
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
            <CommentContent content={comment.content} isDeleted={isDeleted} />
          )}

          {!isDeleted && !isEditing && (
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={handleLike}
                aria-label={t("comment_like")}
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
                  className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-destructive)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("comment_delete")}
                </button>
              )}
            </div>
          )}

          {/* Anonymous comment delete password input */}
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
                onCountChange={onCountChange}
              />
            </div>
          )}
        </div>
      </div>
      {comment.replies.filter(hasVisibleComments).length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {comment.replies.filter(hasVisibleComments).map((r) => (
            <CommentThread
              key={r.id}
              comment={r}
              postId={postId}
              onRefresh={onRefresh}
              depth={depth + 1}
              commenter={commenter}
              allowAnonymous={allowAnonymous}
              isAdmin={isAdmin}
              onCountChange={onCountChange}
            />
          ))}
        </div>
      )}
    </article>
  );
}
