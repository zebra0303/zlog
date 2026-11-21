import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Search, X, Rss, ChevronDown, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PostCard } from "@/entities/post/ui/PostCard";
import { CategoryBadge } from "@/entities/category/ui/CategoryBadge";
import { SubscribeDialog } from "@/features/federation/ui/SubscribeDialog";
import {
  Input,
  Button,
  Pagination,
  SEOHead,
  Skeleton,
  OfflineFallback,
  ZlogLogo,
} from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useCategories } from "@/shared/api/queries";
import { queryKeys } from "@/shared/api/queryKeys";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";
import { useI18n } from "@/shared/i18n";
import type { PostWithCategory, PaginatedResponse } from "@zlog/shared";

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get("page")) || 1;
  const currentCategory = searchParams.get("category") ?? "";
  const currentTag = searchParams.get("tag") ?? "";
  const currentSearch = searchParams.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(currentSearch);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const { lazy_load_images } = useSiteSettingsStore((s) => s.settings);
  const { t } = useI18n();

  // Queries — useCategories shared hook deduplicates with Sidebar
  const { data: categories = [], isLoading: isLoadingCategories } = useCategories();

  const {
    data: posts,
    isLoading,
    isError,
    error: postsError,
  } = useQuery({
    queryKey: queryKeys.posts.list({
      page: currentPage,
      category: currentCategory || undefined,
      tag: currentTag || undefined,
      search: currentSearch || undefined,
    }),
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      if (currentCategory) params.set("category", currentCategory);
      if (currentTag) params.set("tag", currentTag);
      if (currentSearch) params.set("search", currentSearch);
      return api.get<PaginatedResponse<PostWithCategory>>(`/posts?${params.toString()}`);
    },
  });

  const selectedCategory = currentCategory
    ? (categories.find((c) => c.slug === currentCategory) ?? null)
    : null;

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
  // Hide search bar when a category is selected with no posts and no active search
  const hasPosts = !isLoading && !!posts && posts.items.length > 0;
  const showSearch = hasPosts || hasSearch || !currentCategory;

  return (
    <div>
      <SEOHead
        title={selectedCategory?.name}
        description={selectedCategory?.description ?? undefined}
        type={selectedCategory ? "collectionpage" : "website"}
        url={
          selectedCategory
            ? `${window.location.origin}/category/${selectedCategory.slug}`
            : undefined
        }
      />
      {/* Mobile: select box */}
      <div className="mb-4 flex items-center gap-2 md:hidden">
        <div className="relative flex-1">
          {isLoadingCategories ? (
            <Skeleton className="h-7 w-full" />
          ) : (
            <>
              <select
                aria-label={t("home_all")}
                value={currentCategory || ""}
                onChange={(e) => {
                  const slug = e.target.value;
                  const params = new URLSearchParams(searchParams);
                  if (slug) {
                    params.set("category", slug);
                  } else {
                    params.delete("category");
                  }
                  params.set("page", "1");
                  setSearchParams(params);
                }}
                className="border-border bg-surface text-text focus:border-primary w-full cursor-pointer appearance-none rounded-md border py-1 pr-9 pl-3 text-xs font-medium transition-colors focus:outline-none"
              >
                <option value="">{t("home_all")}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="text-text-secondary pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
            </>
          )}
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
        <button
          type="button"
          className="border-border text-text-secondary hover:border-primary hover:text-primary flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
          onClick={() => {
            setShowSubscribe(true);
          }}
        >
          <Rss className="h-3.5 w-3.5" />
          {t("cat_subscribe")}
        </button>
      </div>

      {/* Desktop: category badges */}
      <div className="mb-4 hidden items-start gap-2 md:flex">
        <div className="flex flex-1 flex-wrap gap-2">
          <CategoryBadge slug="all" name={t("home_all")} isActive={!currentCategory} />
          {isLoadingCategories
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-full" />
              ))
            : categories.map((cat) => (
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
        <button
          type="button"
          className="border-border text-text-secondary hover:border-primary hover:text-primary flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
          onClick={() => {
            setShowSubscribe(true);
          }}
        >
          <Rss className="h-3.5 w-3.5" />
          {t("cat_subscribe")}
        </button>
      </div>

      {/* Search — hidden when category selected with no posts */}
      {showSearch && (
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
      )}

      {currentTag && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-text-secondary text-sm">
            {t("home_tag_filter", { tag: currentTag })}
          </span>
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.delete("tag");
              params.set("page", "1");
              setSearchParams(params);
            }}
            className="text-text-secondary hover:text-text"
            aria-label={t("home_tag_clear")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border-border bg-surface overflow-hidden rounded-xl border p-4">
              <Skeleton className="mb-4 aspect-video w-full rounded-lg" />
              <Skeleton className="mb-2 h-6 w-3/4" />
              <Skeleton className="mb-3 h-4 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : isError && postsError.message === "Offline" ? (
        <OfflineFallback />
      ) : posts && posts.items.length > 0 ? (
        <>
          <div className="flex flex-col gap-8">
            {posts.items.map((post, index) => (
              <PostCard
                key={post.id}
                post={post}
                priority={lazy_load_images === "false" || index === 0}
              />
            ))}
          </div>
          <div className="mt-8">
            <Pagination
              currentPage={posts.page}
              totalPages={posts.totalPages}
              onPageChange={handlePageChange}
              buttonClassName="cursor-pointer"
              activeButtonClassName="!bg-[var(--color-primary)] !text-white"
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
        <div className="flex flex-col items-center gap-4 py-16">
          {/* Empty state illustration */}
          <div className="relative mb-2 h-40 w-40 drop-shadow-lg md:h-52 md:w-52">
            <img
              src="/images/empty.webp"
              alt="Quzi mascot"
              className="h-full w-full rounded-2xl object-contain drop-shadow-md"
            />
            <div className="absolute -right-3 -bottom-3 rounded-full bg-[var(--color-surface)] p-1.5 shadow-md">
              <ZlogLogo size={28} />
            </div>
          </div>
          <p className="text-text-secondary text-lg font-medium">{t("home_no_posts")}</p>
          <p className="text-text-secondary text-sm">{t("home_write_first")}</p>
          <Button onClick={() => navigate(-1)} className="mt-2 fill-white stroke-white text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("home_go_back")}
          </Button>
        </div>
      )}

      {showSubscribe && (
        <SubscribeDialog
          category={selectedCategory ?? undefined}
          categories={categories}
          onClose={() => {
            setShowSubscribe(false);
          }}
        />
      )}
    </div>
  );
}
