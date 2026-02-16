import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Rss, Info, X, ExternalLink } from "lucide-react";
import { PostCard } from "@/entities/post/ui/PostCard";
import {
  Pagination,
  SEOHead,
  Skeleton,
  Card,
  CardContent,
  Badge,
  Button,
  Input,
} from "@/shared/ui";
import { api } from "@/shared/api/client";
import { parseMarkdown } from "@/shared/lib/markdown/parser";
import { useAuthStore } from "@/features/auth/model/store";
import { useI18n } from "@/shared/i18n";
import type { CategoryWithStats, PostWithCategory, PaginatedResponse } from "@zlog/shared";

// ============ Subscribe Dialog ============
function SubscribeDialog({
  category,
  onClose,
}: {
  category: CategoryWithStats;
  onClose: () => void;
}) {
  const [blogUrl, setBlogUrl] = useState("");
  const { t } = useI18n();
  const normalizedBlogUrl = blogUrl.trim().replace(/\/$/, "");

  const handleSubscribe = () => {
    if (!normalizedBlogUrl) return;
    const remoteSiteUrl = window.location.origin;
    const params = new URLSearchParams({
      action: "subscribe",
      remoteUrl: remoteSiteUrl,
      remoteCatId: category.id,
      remoteCatName: category.name,
      remoteCatSlug: category.slug,
    });
    const adminUrl = `${normalizedBlogUrl}/admin?${params.toString()}`;
    window.open(adminUrl, "_blank", "noopener");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="border-border bg-surface w-full max-w-lg rounded-xl border shadow-xl"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="border-border flex items-center justify-between border-b p-4">
          <h2 className="text-text flex items-center gap-2 text-lg font-semibold">
            <Rss className="text-primary h-5 w-5" />
            {t("cat_subscribe_title")} &quot;{category.name}&quot; {t("cat_subscribe_category")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="text-text-secondary hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="bg-background mb-4 rounded-lg p-3">
            <div className="mb-2 flex items-start gap-2">
              <Info className="text-primary mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <h3 className="text-text text-sm font-medium">{t("cat_subscribe_what")}</h3>
                <p className="text-text-secondary mt-1 text-xs leading-relaxed">
                  {t("cat_subscribe_desc1")} {t("cat_subscribe_desc2")}
                </p>
                <p className="text-text-secondary mt-1 text-xs leading-relaxed">
                  {t("cat_subscribe_desc3_v2")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-text mb-1 block text-sm font-medium">
                {t("cat_subscribe_blog_url")}
              </label>
              <Input
                placeholder="https://myblog.example.com"
                value={blogUrl}
                onChange={(e) => {
                  setBlogUrl(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubscribe();
                }}
              />
            </div>
            {normalizedBlogUrl && (
              <div className="bg-background text-text-secondary flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {t("cat_subscribe_redirect_desc", { url: normalizedBlogUrl })}
                </span>
              </div>
            )}

            <div className="flex justify-end">
              <Button size="sm" onClick={handleSubscribe} disabled={!normalizedBlogUrl}>
                <ExternalLink className="mr-1 h-4 w-4" />
                {t("cat_subscribe_go_admin")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Main Page ============
export default function CategoryDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get("page")) || 1;
  const [category, setCategory] = useState<CategoryWithStats | null>(null);
  const [posts, setPosts] = useState<PaginatedResponse<PostWithCategory> | null>(null);
  const [descHtml, setDescHtml] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const { t } = useI18n();

  useEffect(() => {
    if (!slug) return;
    void api.get<CategoryWithStats>(`/categories/${slug}`).then(async (c) => {
      setCategory(c);
      if (c.longDescription) setDescHtml(await parseMarkdown(c.longDescription));
    });
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    void api
      .get<PaginatedResponse<PostWithCategory>>(`/posts?category=${slug}&page=${currentPage}`)
      .then((d) => {
        setPosts(d);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [slug, currentPage]);

  if (!category && !isLoading)
    return <p className="text-text-secondary py-20 text-center">{t("cat_not_found")}</p>;

  return (
    <div className="min-w-0 overflow-x-hidden">
      {category && (
        <>
          <SEOHead
            title={category.name}
            description={category.description ?? undefined}
            type="collectionpage"
            url={`${window.location.origin}/category/${category.slug}`}
          />
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <h1 className="text-text mb-2 text-2xl font-bold">{category.name}</h1>
                  {category.description && (
                    <p className="text-text-secondary mb-3">{category.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <Badge variant="secondary">
                      {category.postCount} {t("cat_posts_count")}
                    </Badge>
                    <Badge variant="outline">
                      {category.followerCount} {t("cat_followers_count")}
                    </Badge>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`/category/${category.slug}/rss.xml`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-border text-text-secondary hover:border-primary hover:text-primary flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm transition-colors"
                    title="RSS Feed"
                  >
                    <Rss className="h-4 w-4" />
                    RSS
                  </a>
                  {!isAuthenticated && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowSubscribe(true);
                      }}
                    >
                      <Rss className="mr-1 h-4 w-4" />
                      {t("cat_subscribe")}
                    </Button>
                  )}
                </div>
              </div>
              {descHtml && (
                <div
                  className="prose dark:prose-invert mt-4 max-w-none"
                  dangerouslySetInnerHTML={{ __html: descHtml }}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : posts && posts.items.length > 0 ? (
        <>
          <div className="flex flex-col gap-4">
            {posts.items.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
          <div className="mt-8">
            <Pagination
              currentPage={posts.page}
              totalPages={posts.totalPages}
              onPageChange={(p) => {
                const ps = new URLSearchParams(searchParams);
                ps.set("page", String(p));
                setSearchParams(ps);
              }}
            />
          </div>
        </>
      ) : (
        <p className="text-text-secondary py-10 text-center">{t("cat_no_posts")}</p>
      )}

      {showSubscribe && category && (
        <SubscribeDialog
          category={category}
          onClose={() => {
            setShowSubscribe(false);
          }}
        />
      )}
    </div>
  );
}
