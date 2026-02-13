import { Link } from "react-router";
import { Calendar, Eye, Folder } from "lucide-react";
import { Card, CardContent, Badge, LazyImage } from "@/shared/ui";
import { timeAgo } from "@/shared/lib/formatDate";
import type { PostWithCategory } from "@zlog/shared";

export function PostCard({ post }: { post: PostWithCategory }) {
  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      <Link to={`/posts/${post.slug}`}>
        {post.coverImage && <LazyImage src={post.coverImage} alt={post.title} className="h-48 w-full" />}
        <CardContent className={post.coverImage ? "pt-4" : "pt-6"}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {post.category && <Badge variant="secondary"><Folder className="mr-1 h-3 w-3" />{post.category.name}</Badge>}
            {post.tags.map((tag) => <Badge key={tag.id} variant="outline">{tag.name}</Badge>)}
          </div>
          <h2 className="mb-2 text-lg font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">{post.title}</h2>
          {post.excerpt && <p className="mb-3 text-sm text-[var(--color-text-secondary)] line-clamp-2">{post.excerpt}</p>}
          <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{timeAgo(post.createdAt)}</span>
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.viewCount}</span>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
