import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Search, X, Rss, Info, ExternalLink } from "lucide-react";
import { PostCard } from "@/entities/post/ui/PostCard";
import { CategoryBadge } from "@/entities/category/ui/CategoryBadge";
import { Input, Button, Pagination, SEOHead, Skeleton } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useAuthStore } from "@/features/auth/model/store";
import { useI18n } from "@/shared/i18n";
import type { PostWithCategory, CategoryWithStats, PaginatedResponse } from "@zlog/shared";

// ============ Subscribe Dialog ============
function SubscribeDialog({ category, onClose }: { category: CategoryWithStats; onClose: () => void }) {
  const [blogUrl, setBlogUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { t } = useI18n();
  const normalizedBlogUrl = blogUrl.trim().replace(/\/$/, "");
  const callbackUrl = normalizedBlogUrl ? `${normalizedBlogUrl}/api/federation/webhook` : "";

  const handleSubscribe = async () => {
    if (!normalizedBlogUrl) { setResult({ type: "error", text: t("cat_subscribe_enter_url") }); return; }
    setIsSubmitting(true); setResult(null);
    try {
      const remoteSiteUrl = window.location.origin;
      await api.post("/federation/subscribe", { categoryId: category.id, subscriberUrl: normalizedBlogUrl, callbackUrl });
      try { await fetch(`${normalizedBlogUrl}/api/federation/local-subscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ remoteSiteUrl, remoteCategoryId: category.id, remoteCategoryName: category.name, remoteCategorySlug: category.slug, localCategorySlug: category.slug }) }); } catch { /* ignore */ }
      setResult({ type: "success", text: t("cat_subscribe_success") });
    } catch (err) { setResult({ type: "error", text: err instanceof Error ? err.message : t("cat_subscribe_failed") }); }
    finally { setIsSubmitting(false); }
  };

  const handleUnsubscribe = async () => {
    if (!normalizedBlogUrl) { setResult({ type: "error", text: t("cat_subscribe_enter_url") }); return; }
    setIsSubmitting(true); setResult(null);
    try {
      const remoteSiteUrl = window.location.origin;
      await api.post("/federation/unsubscribe", { categoryId: category.id, subscriberUrl: normalizedBlogUrl });
      try { await fetch(`${normalizedBlogUrl}/api/federation/local-unsubscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ remoteSiteUrl, remoteCategoryId: category.id, localCategorySlug: category.slug }) }); } catch { /* ignore */ }
      setResult({ type: "success", text: t("cat_unsubscribe_success") });
    } catch (err) { setResult({ type: "error", text: err instanceof Error ? err.message : t("cat_unsubscribe_failed") }); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface shadow-xl" onClick={(e) => { e.stopPropagation(); }}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text"><Rss className="h-5 w-5 text-primary" />{t("cat_subscribe_title")} &quot;{category.name}&quot; {t("cat_subscribe_category")}</h2>
          <button type="button" onClick={onClose} aria-label={t("close")} className="text-text-secondary hover:text-text"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4">
          <div className="mb-4 rounded-lg bg-background p-3">
            <div className="mb-2 flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <h3 className="text-sm font-medium text-text">{t("cat_subscribe_what")}</h3>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">{t("cat_subscribe_desc1")} {t("cat_subscribe_desc2")}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">{t("cat_subscribe_desc3")}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">{t("cat_subscribe_blog_url")}</label>
              <Input placeholder="https://myblog.example.com" value={blogUrl} onChange={(e) => { setBlogUrl(e.target.value); }} />
            </div>
            {callbackUrl && (<div><label className="mb-1 block text-xs text-text-secondary">{t("cat_subscribe_callback")}</label><div className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-xs text-text-secondary"><ExternalLink className="h-3 w-3 shrink-0" /><span className="truncate">{callbackUrl}</span></div></div>)}
            {result && (<div className={`rounded-lg p-3 text-sm ${result.type === "success" ? "bg-green-50 text-green-600 dark:bg-green-900/20" : "bg-red-50 text-red-600 dark:bg-red-900/20"}`}>{result.text}</div>)}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleUnsubscribe} disabled={isSubmitting || !normalizedBlogUrl}>{t("cat_unsubscribe")}</Button>
              <Button size="sm" onClick={handleSubscribe} disabled={isSubmitting || !normalizedBlogUrl}><Rss className="mr-1 h-4 w-4" />{isSubmitting ? t("cat_subscribe_processing") : t("cat_subscribe_button")}</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get("page")) || 1;
  const currentCategory = searchParams.get("category") ?? "";
  const currentSearch = searchParams.get("search") ?? "";
  const [posts, setPosts] = useState<PaginatedResponse<PostWithCategory> | null>(null);
  const [categories, setCategories] = useState<CategoryWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(currentSearch);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isAuthenticated } = useAuthStore();
  const { t } = useI18n();

  const selectedCategory = currentCategory
    ? categories.find((c) => c.slug === currentCategory) ?? null
    : null;

  useEffect(() => {
    void api.get<CategoryWithStats[]>("/categories").then(setCategories);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(currentPage));
    if (currentCategory) params.set("category", currentCategory);
    if (currentSearch) params.set("search", currentSearch);
    void api
      .get<PaginatedResponse<PostWithCategory>>(`/posts?${params.toString()}`)
      .then((data) => {
        setPosts(data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [currentPage, currentCategory, currentSearch]);

  // Sync searchInput when URL search param changes externally (e.g. clearing category)
  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  const updateSearch = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set("search", value);
    } else {
      params.delete("search");
    }
    params.set("page", "1");
    setSearchParams(params);
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateSearch(value);
    }, 300);
  };

  const clearSearch = () => {
    setSearchInput("");
    updateSearch("");
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(page));
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const hasSearch = currentSearch.length > 0;

  return (
    <div>
      <SEOHead title={t("home_title")} />
      <div className="mb-4 flex items-start gap-2">
        <div className="flex flex-1 flex-wrap gap-2">
          <CategoryBadge slug="all" name={t("home_all")} isActive={!currentCategory} />
          {categories.map((cat) => (
            <CategoryBadge
              key={cat.id}
              slug={cat.slug}
              name={cat.name}
              isActive={currentCategory === cat.slug}
            />
          ))}
        </div>
        <a
          href={currentCategory ? `/category/${currentCategory}/rss.xml` : "/rss.xml"}
          target="_blank"
          rel="noopener noreferrer"
          className="border-border text-text-secondary hover:border-primary hover:text-primary flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
          title="RSS Feed"
        >
          <Rss className="h-3.5 w-3.5" />
          RSS
        </a>
        {selectedCategory && !isAuthenticated && (
          <button type="button" className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-text-secondary transition-colors hover:border-primary hover:text-primary" onClick={() => { setShowSubscribe(true); }}>
            <Rss className="h-3.5 w-3.5" />{t("cat_subscribe")}
          </button>
        )}
      </div>

      {/* 검색 */}
      <div className="relative mb-6">
        <Search className="text-text-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={searchInput}
          onChange={(e) => {
            handleSearchChange(e.target.value);
          }}
          placeholder={t("home_search_placeholder")}
          className="pr-8 pl-9"
        />
        {searchInput && (
          <button
            type="button"
            onClick={clearSearch}
            className="text-text-secondary hover:text-text absolute top-1/2 right-3 -translate-y-1/2"
            aria-label={t("home_search_clear")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : posts && posts.items.length > 0 ? (
        <>
          <div className="flex flex-col gap-4">
            {posts.items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
          <div className="mt-8">
            <Pagination
              currentPage={posts.page}
              totalPages={posts.totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        </>
      ) : hasSearch ? (
        <div className="py-20 text-center">
          <p className="text-text-secondary text-lg">
            {t("home_no_search_results", { query: currentSearch })}
          </p>
          <button
            type="button"
            onClick={clearSearch}
            className="text-primary mt-3 text-sm hover:underline"
          >
            {t("home_search_clear")}
          </button>
        </div>
      ) : (
        <div className="py-20 text-center">
          <p className="text-text-secondary text-lg">{t("home_no_posts")}</p>
          <p className="text-text-secondary mt-2 text-sm">{t("home_write_first")}</p>
        </div>
      )}

      {showSubscribe && selectedCategory && (
        <SubscribeDialog category={selectedCategory} onClose={() => { setShowSubscribe(false); }} />
      )}
    </div>
  );
}
