import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Rss, Info, X, ExternalLink } from "lucide-react";
import { PostCard } from "@/entities/post/ui/PostCard";
import { Pagination, SEOHead, Skeleton, Card, CardContent, Badge, Button, Input } from "@/shared/ui";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { t } = useI18n();
  const normalizedBlogUrl = blogUrl.trim().replace(/\/$/, "");

  const callbackUrl = normalizedBlogUrl
    ? `${normalizedBlogUrl}/api/federation/webhook`
    : "";

  const handleSubscribe = async () => {
    if (!normalizedBlogUrl) {
      setResult({ type: "error", text: t("cat_subscribe_enter_url") });
      return;
    }
    setIsSubmitting(true);
    setResult(null);
    try {
      const remoteSiteUrl = window.location.origin;
      await api.post("/federation/subscribe", {
        categoryId: category.id,
        subscriberUrl: normalizedBlogUrl,
        callbackUrl,
      });
      try {
        await fetch(`${normalizedBlogUrl}/api/federation/local-subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            remoteSiteUrl,
            remoteCategoryId: category.id,
            remoteCategoryName: category.name,
            remoteCategorySlug: category.slug,
            localCategorySlug: category.slug,
          }),
        });
      } catch {
        // ignore local mapping failure
      }
      setResult({ type: "success", text: t("cat_subscribe_success") });
    } catch (err) {
      setResult({
        type: "error",
        text: err instanceof Error ? err.message : t("cat_subscribe_failed"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!normalizedBlogUrl) {
      setResult({ type: "error", text: t("cat_subscribe_enter_url") });
      return;
    }
    setIsSubmitting(true);
    setResult(null);
    try {
      const remoteSiteUrl = window.location.origin;
      await api.post("/federation/unsubscribe", {
        categoryId: category.id,
        subscriberUrl: normalizedBlogUrl,
      });
      try {
        await fetch(`${normalizedBlogUrl}/api/federation/local-unsubscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            remoteSiteUrl,
            remoteCategoryId: category.id,
            localCategorySlug: category.slug,
          }),
        });
      } catch {
        // ignore
      }
      setResult({ type: "success", text: t("cat_unsubscribe_success") });
    } catch (err) {
      setResult({
        type: "error",
        text: err instanceof Error ? err.message : t("cat_unsubscribe_failed"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-surface shadow-xl"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text">
            <Rss className="h-5 w-5 text-primary" />
            {t("cat_subscribe_title")} &quot;{category.name}&quot; {t("cat_subscribe_category")}
          </h2>
          <button type="button" onClick={onClose} aria-label={t("close")} className="text-text-secondary hover:text-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4 rounded-lg bg-background p-3">
            <div className="mb-2 flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <h3 className="text-sm font-medium text-text">{t("cat_subscribe_what")}</h3>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                  {t("cat_subscribe_desc1")} {t("cat_subscribe_desc2")}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                  {t("cat_subscribe_desc3")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">{t("cat_subscribe_blog_url")}</label>
              <Input
                placeholder="https://myblog.example.com"
                value={blogUrl}
                onChange={(e) => {
                  setBlogUrl(e.target.value);
                }}
              />
            </div>
            {callbackUrl && (
              <div>
                <label className="mb-1 block text-xs text-text-secondary">{t("cat_subscribe_callback")}</label>
                <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-xs text-text-secondary">
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{callbackUrl}</span>
                </div>
              </div>
            )}

            {result && (
              <div
                className={`rounded-lg p-3 text-sm ${result.type === "success" ? "bg-green-50 text-green-600 dark:bg-green-900/20" : "bg-red-50 text-red-600 dark:bg-red-900/20"}`}
              >
                {result.text}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleUnsubscribe} disabled={isSubmitting || !normalizedBlogUrl}>
                {t("cat_unsubscribe")}
              </Button>
              <Button size="sm" onClick={handleSubscribe} disabled={isSubmitting || !normalizedBlogUrl}>
                <Rss className="mr-1 h-4 w-4" />
                {isSubmitting ? t("cat_subscribe_processing") : t("cat_subscribe_button")}
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
    return (
      <p className="py-20 text-center text-text-secondary">{t("cat_not_found")}</p>
    );

  return (
    <div className="min-w-0 overflow-x-hidden">
      {category && (
        <>
          <SEOHead title={category.name} description={category.description ?? undefined} />
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <h1 className="mb-2 text-2xl font-bold text-text">{category.name}</h1>
                  {category.description && (
                    <p className="mb-3 text-text-secondary">{category.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <Badge variant="secondary">{category.postCount} {t("cat_posts_count")}</Badge>
                    <Badge variant="outline">{category.followerCount} {t("cat_followers_count")}</Badge>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`/category/${category.slug}/rss.xml`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm text-text-secondary transition-colors hover:border-primary hover:text-primary"
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
                  className="prose mt-4 max-w-none dark:prose-invert"
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
        <p className="py-10 text-center text-text-secondary">
          {t("cat_no_posts")}
        </p>
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
