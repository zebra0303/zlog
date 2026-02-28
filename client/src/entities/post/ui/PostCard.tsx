import { Link, useLocation } from "react-router";
import { Calendar, Eye, Folder, Globe, ExternalLink, MessageCircle, Heart } from "lucide-react";
import { Card, CardContent, Badge, LazyImage } from "@/shared/ui";
import { timeAgo } from "@/shared/lib/formatDate";
import { useI18n } from "@/shared/i18n";
import type { PostWithCategory } from "@zlog/shared";

interface PostCardProps {
  post: PostWithCategory & {
    isRemote?: boolean;
    remoteUri?: string | null;
    remoteBlog?: {
      siteUrl: string;
      displayName: string | null;
      blogTitle: string | null;
      avatarUrl: string | null;
    } | null;
  };
  priority?: boolean;
}

export function PostCard({ post, priority = false }: PostCardProps) {
  const linkTo = post.isRemote ? `/remote-posts/${post.id}` : `/posts/${post.slug}`;
  const location = useLocation();
  const { t } = useI18n();

  const sourceUrl = post.isRemote ? (post.remoteUri ?? post.remoteBlog?.siteUrl ?? null) : null;

  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      <Link
        to={linkTo}
        state={{ from: location.pathname + location.search }}
        className="block rounded-t-lg focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] focus-visible:outline-none"
      >
        {post.coverImage && (
          <LazyImage
            src={post.coverImage}
            alt={post.title}
            className="aspect-video h-auto w-full"
            objectFit="contain"
            priority={priority}
          />
        )}
        <CardContent className={post.coverImage ? "pt-4" : "pt-6"}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {post.category && (
              <Badge variant="secondary">
                <Folder className="mr-1 h-3 w-3" />
                {post.category.name}
              </Badge>
            )}
            {post.isRemote && (
              <Badge
                variant="outline"
                className="border-[var(--color-primary-light)] text-[var(--color-primary)]"
              >
                <Globe className="mr-1 h-3 w-3" />
                {post.remoteBlog?.displayName ?? t("post_external_blog")}
              </Badge>
            )}
          </div>
          <h2 className="mb-2 line-clamp-2 text-lg font-bold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="mb-3 line-clamp-2 text-sm text-[var(--color-text-secondary)]">
              {post.excerpt}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-secondary)]">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {timeAgo(post.createdAt)}
            </span>
            {!post.isRemote && (
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {post.viewCount.toLocaleString()}
              </span>
            )}
            {!post.isRemote && post.commentCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {post.commentCount.toLocaleString()}
              </span>
            )}
            {!post.isRemote && post.likeCount > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {post.likeCount.toLocaleString()}
              </span>
            )}
            {post.tags.map((tag) => {
              const tagParams = new URLSearchParams(location.search);
              tagParams.set("tag", tag.slug);
              tagParams.delete("page");
              return (
                <Link
                  key={tag.id}
                  to={`${location.pathname}?${tagParams.toString()}`}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="rounded-full border border-[var(--color-border)] px-2 py-px text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                >
                  #{tag.name}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Link>
      {post.isRemote && sourceUrl && (
        <div className="border-t border-[var(--color-border)] px-4 py-2">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
            }}
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
