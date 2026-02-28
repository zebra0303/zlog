import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useLocation } from "react-router";
import {
  Calendar,
  Eye,
  Folder,
  ArrowLeft,
  Edit,
  Trash2,
  Share2,
  Link2,
  Check,
  MessageCircle,
  Heart,
} from "lucide-react";
import { getErrorMessage } from "@/shared/lib/getErrorMessage";
import { Badge, Button, Card, CardContent, SEOHead, Skeleton } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { formatDate } from "@/shared/lib/formatDate";
import { getVisitorId } from "@/shared/lib/visitorId";
import { parseMarkdown } from "@/shared/lib/markdown/parser";
import { useAuthStore } from "@/features/auth/model/store";
import { CommentSection } from "@/features/comment/ui/CommentSection";
import { useI18n } from "@/shared/i18n";
import type { PostWithCategory } from "@zlog/shared";

export default function PostDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const backTo = (location.state as { from?: string } | null)?.from ?? "/";
  const { isAuthenticated } = useAuthStore();
  const { t } = useI18n();
  const [post, setPost] = useState<PostWithCategory | null>(null);
  const [localCommentCount, setLocalCommentCount] = useState(0);
  const [localLikeCount, setLocalLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [htmlContent, setHtmlContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLikeSubmitting, setIsLikeSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    const referrer = document.referrer;
    void api
      .get<PostWithCategory>(
        `/posts/${slug}?visitorId=${getVisitorId()}`,
        referrer ? { "X-Referrer": referrer } : undefined,
      )
      .then(async (data) => {
        setPost(data);
        setLocalCommentCount(data.commentCount);
        setLocalLikeCount(data.likeCount);
        setIsLiked(!!data.isLikedByMe);
        setHtmlContent(await parseMarkdown(data.content));
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        setError(getErrorMessage(err, "Failed to load post"));
        setIsLoading(false);
      });
  }, [slug, t]);

  const handleDelete = async () => {
    if (!post || !confirm(t("post_confirm_delete"))) return;
    try {
      await api.delete(`/posts/${post.id}`);
      window.location.href = "/";
    } catch {
      alert(t("post_delete_failed"));
    }
  };

  const handleCommentCountChange = useCallback((delta: number) => {
    setLocalCommentCount((prev) => Math.max(0, prev + delta));
  }, []);

  const handleLike = async () => {
    if (!post || isLikeSubmitting) return;
    setIsLikeSubmitting(true);

    // Optimistic update
    const prevLiked = isLiked;
    setIsLiked(!prevLiked);
    setLocalLikeCount((prev) => (prevLiked ? prev - 1 : prev + 1));

    try {
      const res = await api.post<{ liked: boolean }>(`/posts/${post.id}/like`, {
        visitorId: getVisitorId(),
      });
      setIsLiked(res.liked);
    } catch {
      // Revert on error
      setIsLiked(prevLiked);
      setLocalLikeCount((prev) => (prevLiked ? prev + 1 : prev - 1));
    } finally {
      setIsLikeSubmitting(false);
    }
  };

  if (isLoading)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (error || !post)
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-[var(--color-text-secondary)]">{error ?? t("post_not_found")}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link to={backTo}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("post_go_home")}
          </Link>
        </Button>
      </div>
    );

  const postUrl = `${window.location.origin}/posts/${post.slug}`;

  return (
    <article className="min-w-0 overflow-x-hidden">
      <SEOHead
        title={post.title}
        description={post.excerpt ?? undefined}
        type="article"
        url={`${window.location.origin}/posts/${post.slug}`}
        image={post.coverImage ?? undefined}
        publishedTime={post.createdAt}
        modifiedTime={post.updatedAt}
        tags={post.tags.map((tg) => tg.name)}
      />
      <div data-print-hide>
        <Button variant="ghost" size="sm" className="mb-4" asChild>
          <Link to={backTo}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("post_go_list")}
          </Link>
        </Button>
      </div>
      {post.coverImage && (
        <img
          src={post.coverImage}
          alt={post.title}
          className="mb-6 aspect-video h-auto w-full rounded-xl object-cover"
        />
      )}
      <div className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {post.category && (
            <Link to={`/category/${post.category.slug}`}>
              <Badge variant="secondary">
                <Folder className="mr-1 h-3 w-3" />
                {post.category.name}
              </Badge>
            </Link>
          )}
          <div className="ml-auto flex items-center gap-2" data-print-hide>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(postUrl).then(() => {
                  setCopied(true);
                  setTimeout(() => {
                    setCopied(false);
                  }, 2000);
                });
              }}
              className="border-border text-text-secondary hover:border-primary hover:text-primary inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
              {copied ? t("share_copied") : t("share_copy_link")}
            </button>
            {typeof navigator.share === "function" ? (
              <button
                type="button"
                onClick={() => {
                  void navigator.share({
                    title: post.title,
                    text: post.excerpt ?? post.title,
                    url: postUrl,
                  });
                }}
                className="border-border text-text-secondary hover:border-primary hover:text-primary inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
              >
                <Share2 className="h-3.5 w-3.5" />
                {t("share_native")}
              </button>
            ) : (
              <>
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(post.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on X (opens in new tab)"
                  className="border-border text-text-secondary hover:border-primary hover:text-primary inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
                >
                  X
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on Facebook (opens in new tab)"
                  className="border-border text-text-secondary hover:border-primary hover:text-primary inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
                >
                  Facebook
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on LinkedIn (opens in new tab)"
                  className="border-border text-text-secondary hover:border-primary hover:text-primary inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
                >
                  LinkedIn
                </a>
              </>
            )}
          </div>
        </div>
        <h1 className="mb-3 text-2xl font-bold text-[var(--color-text)] md:text-3xl">
          {post.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--color-text-secondary)]">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDate(post.createdAt)}
          </span>
          {new Date(post.updatedAt).getTime() - new Date(post.createdAt).getTime() > 60000 && (
            <span
              className="text-text-secondary flex items-center gap-1 text-xs"
              title={new Date(post.updatedAt).toLocaleString()}
            >
              ({t("post_updated")} {formatDate(post.updatedAt)})
            </span>
          )}
          <span className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {post.viewCount.toLocaleString()}
          </span>
          {localCommentCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              {localCommentCount.toLocaleString()}
            </span>
          )}
          {localLikeCount > 0 && (
            <span className="flex items-center gap-1">
              <Heart
                className={`h-4 w-4 ${isLiked ? "fill-[var(--color-accent)] text-[var(--color-accent)]" : ""}`}
              />
              {localLikeCount.toLocaleString()}
            </span>
          )}
          {post.tags.map((tag) => {
            const [backPath, backQuery] = backTo.split("?");
            const tagParams = new URLSearchParams(backQuery ?? "");
            tagParams.set("tag", tag.slug);
            tagParams.delete("page");
            return (
              <Link
                key={tag.id}
                to={`${backPath}?${tagParams.toString()}`}
                className="border-border text-text-secondary hover:border-primary hover:text-primary rounded-full border px-2.5 py-px text-xs font-medium transition-colors"
              >
                #{tag.name}
              </Link>
            );
          })}
        </div>
        {isAuthenticated && (
          <div className="mt-4 flex gap-2" data-print-hide>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/write/${post.id}`} state={{ from: backTo }}>
                <Edit className="mr-1 h-4 w-4" />
                {t("post_edit")}
              </Link>
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="mr-1 h-4 w-4" />
              {t("post_delete")}
            </Button>
          </div>
        )}
      </div>
      <Card>
        <CardContent className="pt-6">
          <div
            className="prose dark:prose-invert md:prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />

          <div className="mt-8 flex justify-center border-t border-[var(--color-border)] pt-6">
            <button
              onClick={handleLike}
              disabled={isLikeSubmitting || isAuthenticated}
              title={isAuthenticated ? t("post_like_admin_forbidden") : ""}
              className={`group flex items-center gap-2 rounded-full border-2 px-4 py-1.5 transition-all ${
                isAuthenticated
                  ? "cursor-not-allowed border-[var(--color-border)] opacity-50"
                  : isLiked
                    ? "border-[var(--color-accent)] text-[var(--color-accent)] shadow-sm active:scale-95"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] active:scale-95"
              }`}
              style={
                !isAuthenticated && isLiked
                  ? { backgroundColor: "color-mix(in srgb, var(--color-accent), transparent 92%)" }
                  : {}
              }
            >
              <Heart className={`h-5 w-5 transition-colors ${isLiked ? "fill-current" : ""}`} />
              <span className="text-sm font-bold">{localLikeCount.toLocaleString()}</span>
            </button>
          </div>
        </CardContent>
      </Card>
      <div className="mt-8" data-print-hide>
        <CommentSection postId={post.id} onCountChange={handleCommentCountChange} />
      </div>
    </article>
  );
}
