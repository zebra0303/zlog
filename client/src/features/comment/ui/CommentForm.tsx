import { useEffect, useRef, useState } from "react";
import { Button, Card, CardContent, Input, Textarea, DefaultAvatar } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n";
import { getErrorMessage } from "@/shared/lib/getErrorMessage";
import type { CommenterInfo } from "./types";

interface CommentFormProps {
  postId: string;
  parentId?: string;
  onSuccess: () => void;
  onCancel?: () => void;
  commenter: CommenterInfo | null;
  allowAnonymous: boolean;
  onCountChange?: (delta: number) => void;
}

export function CommentForm({
  postId,
  parentId,
  onSuccess,
  onCancel,
  commenter,
  allowAnonymous,
  onCountChange,
}: CommentFormProps) {
  const [content, setContent] = useState("");
  const [anonName, setAnonName] = useState("");
  const [anonEmail, setAnonEmail] = useState("");
  const [anonPassword, setAnonPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useI18n();

  // After SSO login → scroll to comment input + focus + highlight
  useEffect(() => {
    if (commenter && !parentId && localStorage.getItem("zlog_oauth_just_logged_in")) {
      localStorage.removeItem("zlog_oauth_just_logged_in");
      // Layout may shift due to image/markdown rendering, so retry scroll multiple times
      let count = 0;
      const maxRetries = 5;
      const doScroll = () => {
        textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        if (count === 0) {
          textareaRef.current?.focus();
          setHighlight(true);
          setTimeout(() => {
            setHighlight(false);
          }, 2000);
        }
        count++;
        if (count < maxRetries) {
          timer = window.setTimeout(doScroll, 500);
        }
      };
      let timer = window.setTimeout(doScroll, 300);
      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [commenter, parentId]);

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
      onCountChange?.(1);
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, t("comment_write_failed")));
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
            ref={textareaRef}
            className={
              highlight
                ? "ring-2 ring-[var(--color-primary)] transition-shadow duration-500"
                : "transition-shadow duration-500"
            }
            placeholder={t("comment_placeholder")}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
            }}
            required
            maxLength={2000}
            rows={3}
          />
          {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
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
