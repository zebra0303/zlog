import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { Calendar, Globe, ArrowLeft, ExternalLink } from "lucide-react";
import { Badge, Button, Card, CardContent, SEOHead, Skeleton } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { formatDate } from "@/shared/lib/formatDate";
import { parseMarkdown } from "@/shared/lib/markdown/parser";
import { useI18n } from "@/shared/i18n";

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
  const [post, setPost] = useState<RemotePost | null>(null);
  const [htmlContent, setHtmlContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    void api
      .get<RemotePost>(`/federation/remote-posts/${id}`)
      .then(async (data) => {
        // 원본이 삭제된 경우
        if (data.remoteStatus === "deleted") {
          alert(t("remote_post_deleted_alert"));
          void navigate("/");
          return;
        }
        setPost(data);
        setHtmlContent(await parseMarkdown(data.content));
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load remote post");
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
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("post_go_home")}
          </Link>
        </Button>
      </div>
    );

  return (
    <article className="min-w-0 overflow-x-hidden">
      <SEOHead title={post.title} description={post.excerpt ?? undefined} />
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link to="/">
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("post_go_list")}
        </Link>
      </Button>
      {post.coverImage && (
        <img src={post.coverImage} alt={post.title} className="mb-6 h-64 w-full rounded-xl object-cover" />
      )}
      <div className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400">
            <Globe className="mr-1 h-3 w-3" />
            {post.remoteBlog?.displayName ?? t("post_external_blog")}
          </Badge>
        </div>
        <h1 className="mb-3 text-2xl md:text-3xl font-bold text-[var(--color-text)]">{post.title}</h1>
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
          >
            <ExternalLink className="h-3 w-3" />
            {t("post_view_original")}
          </a>
        )}
      </div>
      <Card>
        <CardContent className="pt-6">
          <div
            className="prose max-w-none dark:prose-invert md:prose-lg"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </CardContent>
      </Card>
    </article>
  );
}
