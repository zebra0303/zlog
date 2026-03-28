import { useEffect, useRef, useState } from "react";
import { sanitizeHtml } from "@/shared/lib/security/sanitize";
import { useParams, useSearchParams, useNavigate } from "react-router";
import { Rss, Info, X, ExternalLink, Tag, ArrowLeft, Search } from "lucide-react";
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
  ZlogLogo,
} from "@/shared/ui";
import { api } from "@/shared/api/client";
import { parseMarkdown } from "@/shared/lib/markdown/parser";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  const normalizedBlogUrl = blogUrl.trim().replace(/\/$/, "");
  const isValidUrl = /^https?:\/\/.+/.test(normalizedBlogUrl);
  // Block subscribing to own blog
  const isSelfUrl =
    isValidUrl &&
    normalizedBlogUrl.replace(/\/$/, "") === window.location.origin.replace(/\/$/, "");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubscribe = () => {
    if (!normalizedBlogUrl || isSelfUrl) return;
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
                ref={inputRef}
                placeholder="https://myblog.example.com"
                value={blogUrl}
                onChange={(e) => {
                  setBlogUrl(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubscribe();
                }}
              />
              {isSelfUrl && (
                <p className="mt-1 text-xs text-red-500">{t("cat_subscribe_self_url")}</p>
              )}
            </div>
            {normalizedBlogUrl && !isSelfUrl && (
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
                disabled={!normalizedBlogUrl || isSelfUrl}
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

// ============ Main Page ============
export default function CategoryDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get("page")) || 1;
  const currentTag = searchParams.get("tag") ?? "";
  const currentSearch = searchParams.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [category, setCategory] = useState<CategoryWithStats | null>(null);
  const [posts, setPosts] = useState<PaginatedResponse<PostWithCategory> | null>(null);
  const [descHtml, setDescHtml] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const navigate = useNavigate();
  const { lazy_load_images } = useSiteSettingsStore((s) => s.settings);
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
    const params = new URLSearchParams();
    params.set("category", slug);
    params.set("page", String(currentPage));
    if (currentTag) params.set("tag", currentTag);
    if (currentSearch) params.set("search", currentSearch);
    void api
      .get<PaginatedResponse<PostWithCategory>>(`/posts?${params.toString()}`)
      .then((d) => {
        setPosts(d);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [slug, currentPage, currentTag, currentSearch]);

  // Sync searchInput when URL search param changes externally
  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  const updateSearch = (value: string) => {
    const ps = new URLSearchParams(searchParams);
    if (value) {
      ps.set("search", value);
    } else {
      ps.delete("search");
    }
    ps.set("page", "1");
    setSearchParams(ps);
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
            <CardContent className="p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <h1 className="text-text mb-2 text-2xl font-bold">{category.name}</h1>
                  {category.description && (
                    <p className="text-text-secondary mb-3">{category.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <Badge variant="secondary">
                      {category.postCount.toLocaleString()} {t("cat_posts_count")}
                    </Badge>
                    <Badge variant="outline">
                      {category.followerCount.toLocaleString()} {t("cat_followers_count")}
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
                </div>
              </div>
              {descHtml && (
                <div
                  className="prose dark:prose-invert mt-4 max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(descHtml) }}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Search — only shown when posts exist or search is active */}
      {(!isLoading && posts && posts.items.length > 0) || currentSearch ? (
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
      ) : null}

      {currentTag && (
        <div className="mb-4 flex items-center gap-2">
          <Tag className="text-text-secondary h-4 w-4" />
          <span className="text-text-secondary text-sm">
            {t("home_tag_filter", { tag: currentTag })}
          </span>
          <button
            type="button"
            onClick={() => {
              const ps = new URLSearchParams(searchParams);
              ps.delete("tag");
              ps.set("page", "1");
              setSearchParams(ps);
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
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : posts && posts.items.length > 0 ? (
        <>
          <div className="flex flex-col gap-4">
            {posts.items.map((p, index) => (
              <PostCard
                key={p.id}
                post={p}
                priority={lazy_load_images === "false" || index === 0}
              />
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
              buttonClassName="cursor-pointer"
              activeButtonClassName="!bg-[var(--color-primary)] !text-white"
            />
          </div>
        </>
      ) : currentSearch ? (
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
          <p className="text-text-secondary text-lg font-medium">{t("cat_no_posts")}</p>
          <Button onClick={() => navigate(-1)} className="mt-2 fill-white stroke-white text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("home_go_back")}
          </Button>
        </div>
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
