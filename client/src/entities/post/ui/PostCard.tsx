import { Link, useLocation } from "react-router";
import { Calendar, Eye, Folder, Globe, ExternalLink } from "lucide-react";
import { Card, CardContent, Badge, LazyImage } from "@/shared/ui";
import { timeAgo } from "@/shared/lib/formatDate";
import { useI18n } from "@/shared/i18n";
import type { PostWithCategory } from "@zlog/shared";

interface PostCardProps {
  post: PostWithCategory & {
    isRemote?: boolean;
    remoteUri?: string | null;
    remoteBlog?: { siteUrl: string; displayName: string | null; blogTitle: string | null; avatarUrl: string | null } | null;
  };
}

export function PostCard({ post }: PostCardProps) {
  const linkTo = post.isRemote ? `/remote-posts/${post.id}` : `/posts/${post.slug}`;
  const location = useLocation();
  const { t } = useI18n();

  const sourceUrl = post.isRemote
    ? (post.remoteUri ?? post.remoteBlog?.siteUrl ?? null)
    : null;

  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      <Link to={linkTo} state={{ from: location.pathname + location.search }}>
        {post.coverImage && <LazyImage src={post.coverImage} alt={post.title} className="h-48 w-full" />}
        <CardContent className={post.coverImage ? "pt-4" : "pt-6"}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {post.category && <Badge variant="secondary"><Folder className="mr-1 h-3 w-3" />{post.category.name}</Badge>}
            {post.isRemote && (
              <Badge variant="outline" className="border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400">
                <Globe className="mr-1 h-3 w-3" />{post.remoteBlog?.displayName ?? t("post_external_blog")}
              </Badge>
            )}
            {post.tags?.map((tag) => <Badge key={tag.id} variant="outline">{tag.name}</Badge>)}
          </div>
          <h2 className="mb-2 text-lg font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">{post.title}</h2>
          {post.excerpt && <p className="mb-3 text-sm text-[var(--color-text-secondary)] line-clamp-2">{post.excerpt}</p>}
          <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{timeAgo(post.createdAt)}</span>
            {!post.isRemote && <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.viewCount}</span>}
          </div>
        </CardContent>
      </Link>
      {post.isRemote && sourceUrl && (
        <div className="border-t border-[var(--color-border)] px-4 py-2">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.stopPropagation(); }}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {t("post_view_original")}
            <span className="ml-1 max-w-[200px] truncate text-[var(--color-text-secondary)]">
              {new URL(sourceUrl).hostname}
            </span>
          </a>
        </div>
      )}
    </Card>
  );
}
