import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Search, X, Rss, Info, ExternalLink, ChevronDown, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PostCard } from "@/entities/post/ui/PostCard";
import { CategoryBadge } from "@/entities/category/ui/CategoryBadge";
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
import type { PostWithCategory, CategoryWithStats, PaginatedResponse } from "@zlog/shared";

// ============ Subscribe Dialog ============
function SubscribeDialog({
  category,
  categories,
  onClose,
}: {
  category?: CategoryWithStats; // optional: when omitted, show category selector first
  categories: CategoryWithStats[];
  onClose: () => void;
}) {
  const [blogUrl, setBlogUrl] = useState("");
  const [selectedCat, setSelectedCat] = useState<CategoryWithStats | null>(category ?? null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  const normalizedBlogUrl = blogUrl.trim().replace(/\/$/, "");
  // Validate URL starts with http:// or https://
  const isValidUrl = /^https?:\/\/.+/.test(normalizedBlogUrl);
  // Block subscribing to own blog
  const isSelfUrl =
    isValidUrl &&
    normalizedBlogUrl.replace(/\/$/, "") === window.location.origin.replace(/\/$/, "");

  // Focus input when category is already selected
  useEffect(() => {
    if (selectedCat) {
      inputRef.current?.focus();
    }
  }, [selectedCat]);

  const handleSubscribe = () => {
    if (!isValidUrl || !selectedCat || isSelfUrl) return;
    const remoteSiteUrl = window.location.origin;
    const params = new URLSearchParams({
      action: "subscribe",
      remoteUrl: remoteSiteUrl,
      remoteCatId: selectedCat.id,
      remoteCatName: selectedCat.name,
      remoteCatSlug: selectedCat.slug,
    });
    const adminUrl = `${normalizedBlogUrl}/admin?${params.toString()}`;
    window.open(adminUrl, "_blank", "noopener");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
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
            {selectedCat ? (
              <>
                {t("cat_subscribe_title")} &quot;{selectedCat.name}&quot;{" "}
                {t("cat_subscribe_category")}
              </>
            ) : (
              t("cat_subscribe_select_from_list")
            )}
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
            {/* Category selector: shown when no category was pre-selected */}
            {!category && (
              <div>
                <label className="text-text mb-1 block text-sm font-medium">
                  {t("cat_subscribe_select_category")}
                </label>
                <div className="relative">
                  <select
                    value={selectedCat?.id ?? ""}
                    onChange={(e) => {
                      const cat = categories.find((c) => c.id === e.target.value) ?? null;
                      setSelectedCat(cat);
                    }}
                    className="border-border bg-surface text-text focus:border-primary w-full cursor-pointer appearance-none rounded-md border py-2 pr-9 pl-3 text-sm transition-colors focus:outline-none"
                    aria-label={t("cat_subscribe_select_category")}
                  >
                    <option value="">{t("cat_subscribe_select_placeholder")}</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="text-text-secondary pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
                </div>
              </div>
            )}
            <div>
              <label className="text-text mb-1 block text-sm font-medium">
                {t("cat_subscribe_blog_url")}
              </label>
              <Input
                ref={inputRef}
                placeholder="https://myblog.example.com"
                value={blogUrl}
                onChange={(e) => {
                  setBlogUrl(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubscribe();
                }}
                disabled={!selectedCat}
              />
              {/* URL validation hints */}
              {normalizedBlogUrl && !isValidUrl && (
                <p className="mt-1 text-xs text-red-500">{t("cat_subscribe_invalid_url")}</p>
              )}
              {isSelfUrl && (
                <p className="mt-1 text-xs text-red-500">{t("cat_subscribe_self_url")}</p>
              )}
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
              <Button
                size="sm"
                onClick={handleSubscribe}
                disabled={!isValidUrl || !selectedCat || isSelfUrl}
              >
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

      {/* Search */}
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
          <div className="flex flex-col gap-4">
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
