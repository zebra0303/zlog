import { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router";
import { Calendar, ArrowLeft, ExternalLink } from "lucide-react";
import { Button, Card, CardContent, DefaultAvatar, SEOHead, Skeleton } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { formatDate } from "@/shared/lib/formatDate";
import { parseMarkdown } from "@/shared/lib/markdown/parser";
import { useI18n } from "@/shared/i18n";
import { getErrorMessage } from "@/shared/lib/getErrorMessage";
import { RemoteCommentList } from "./RemoteCommentList";

import { getVisitorId } from "@/shared/lib/visitorId";

interface RemotePost {
  id: string;
  remoteUri: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  remoteStatus: string;
  authorName: string | null;
  remoteCreatedAt: string;
  remoteUpdatedAt: string;
  localCategoryId: string | null;
  remoteBlog: {
    siteUrl: string;
    displayName: string | null;
    blogTitle: string | null;
    avatarUrl: string | null;
  } | null;
}

export default function RemotePostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = (location.state as { from?: string } | null)?.from ?? "/";
  const [post, setPost] = useState<RemotePost | null>(null);
  const [htmlContent, setHtmlContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    void api
      .get<RemotePost>(`/federation/remote-posts/${id}`)
      .then(async (data) => {
        // If the original has been deleted
        if (data.remoteStatus === "deleted") {
          alert(t("remote_post_deleted_alert"));
          void navigate("/");
          return;
        }
        setPost(data);
        setHtmlContent(await parseMarkdown(data.content));
        setIsLoading(false);

        // Record visit to the original blog
        if (data.remoteUri && data.remoteBlog) {
          const uriParts = data.remoteUri.split("/posts/");
          const originalPostId = uriParts.length > 1 ? uriParts[uriParts.length - 1] : null;
          if (originalPostId) {
            void fetch(`${data.remoteBlog.siteUrl}/api/federation/posts/${originalPostId}/view`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                visitorId: getVisitorId(),
                subscriberUrl: window.location.origin,
              }),
            }).catch(() => null); // Silently fail if original blog is down or doesn't support this
          }
        }
      })
      .catch((err: unknown) => {
        setError(getErrorMessage(err, "Failed to load remote post"));
        setIsLoading(false);
      });
  }, [id, navigate, t]);

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

  return (
    <article className="min-w-0 overflow-x-hidden">
      <SEOHead title={post.title} description={post.excerpt ?? undefined} />
      <div data-print-hide>
        <Button variant="ghost" size="sm" className="mb-4" asChild>
          <Link to={backTo}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("post_go_list")}
          </Link>
        </Button>
      </div>
      {post.coverImage && (
        <img src={post.coverImage} alt={post.title} className="mb-6 h-auto w-full rounded-xl" />
      )}
      <div className="mb-8">
        {/* Original blog profile card + title area */}
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="order-2 min-w-0 flex-1 sm:order-1">
            <h1 className="mb-3 text-2xl font-bold text-[var(--color-text)] md:text-3xl">
              {post.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-[var(--color-text-secondary)]">
              {post.authorName && <span>{post.authorName}</span>}
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(post.remoteCreatedAt)}
              </span>
            </div>
            {post.remoteUri && (
              <a
                href={post.remoteUri}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
                data-print-hide
              >
                <ExternalLink className="h-3 w-3" />
                {t("post_view_original")}
              </a>
            )}
          </div>

          {/* Original blog profile */}
          {post.remoteBlog && (
            <a
              href={post.remoteBlog.siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="order-1 flex shrink-0 items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:bg-[var(--color-background)] sm:order-2 sm:max-w-[220px]"
              data-print-hide
            >
              {post.remoteBlog.avatarUrl ? (
                <img
                  src={post.remoteBlog.avatarUrl}
                  alt={post.remoteBlog.displayName ?? ""}
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                />
              ) : (
                <DefaultAvatar size={48} />
              )}
              <div className="min-w-0">
                {post.remoteBlog.blogTitle && (
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                    {post.remoteBlog.blogTitle}
                  </p>
                )}
                <p className="truncate text-xs text-[var(--color-text-secondary)]">
                  {post.remoteBlog.displayName ?? post.remoteBlog.siteUrl}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-primary)]">
                  <ExternalLink className="h-2.5 w-2.5" />
                  {t("remote_post_visit_blog")}
                </p>
              </div>
            </a>
          )}
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div
            className="prose dark:prose-invert md:prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </CardContent>
      </Card>

      <RemoteCommentList remotePostId={post.id} />
    </article>
  );
}
