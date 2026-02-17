import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router";
import { Calendar, Eye, Folder, ArrowLeft, Edit, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, SEOHead, Skeleton } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { formatDate } from "@/shared/lib/formatDate";
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
  const [htmlContent, setHtmlContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    void api
      .get<PostWithCategory>(`/posts/${slug}`)
      .then(async (data) => {
        setPost(data);
        setHtmlContent(await parseMarkdown(data.content));
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load post");
        setIsLoading(false);
      });
  }, [slug]);

  const handleDelete = async () => {
    if (!post || !confirm(t("post_confirm_delete"))) return;
    try {
      await api.delete(`/posts/${post.id}`);
      window.location.href = "/";
    } catch {
      alert(t("post_delete_failed"));
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
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link to={backTo}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("post_go_list")}
        </Link>
      </Button>
      {post.coverImage && (
        <img src={post.coverImage} alt={post.title} className="mb-6 h-auto w-full rounded-xl" />
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
          {post.tags.map((tag) => (
            <Badge key={tag.id} variant="outline">
              {tag.name}
            </Badge>
          ))}
        </div>
        <h1 className="mb-3 text-2xl font-bold text-[var(--color-text)] md:text-3xl">
          {post.title}
        </h1>
        <div className="flex items-center gap-4 text-sm text-[var(--color-text-secondary)]">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDate(post.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {post.viewCount}
          </span>
        </div>
        {isAuthenticated && (
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/write/${post.id}`}>
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
        </CardContent>
      </Card>
      <div className="mt-8">
        <CommentSection postId={post.id} />
      </div>
    </article>
  );
}
