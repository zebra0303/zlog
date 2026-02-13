import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Search, X } from "lucide-react";
import { PostCard } from "@/entities/post/ui/PostCard";
import { CategoryBadge } from "@/entities/category/ui/CategoryBadge";
import { Input, Pagination, SEOHead, Skeleton } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n";
import type { PostWithCategory, CategoryWithStats, PaginatedResponse } from "@zlog/shared";

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get("page")) || 1;
  const currentCategory = searchParams.get("category") ?? "";
  const currentSearch = searchParams.get("search") ?? "";
  const [posts, setPosts] = useState<PaginatedResponse<PostWithCategory> | null>(null);
  const [categories, setCategories] = useState<CategoryWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useI18n();

  useEffect(() => { void api.get<CategoryWithStats[]>("/categories").then(setCategories); }, []);

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(currentPage));
    if (currentCategory) params.set("category", currentCategory);
    if (currentSearch) params.set("search", currentSearch);
    void api.get<PaginatedResponse<PostWithCategory>>(`/posts?${params.toString()}`).then((data) => { setPosts(data); setIsLoading(false); }).catch(() => setIsLoading(false));
  }, [currentPage, currentCategory, currentSearch]);

  // Sync searchInput when URL search param changes externally (e.g. clearing category)
  useEffect(() => { setSearchInput(currentSearch); }, [currentSearch]);

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
    debounceRef.current = setTimeout(() => updateSearch(value), 300);
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
      <div className="mb-4 flex flex-wrap gap-2">
        <CategoryBadge slug="all" name={t("home_all")} isActive={!currentCategory} />
        {categories.map((cat) => <CategoryBadge key={cat.id} slug={cat.slug} name={cat.name} isActive={currentCategory === cat.slug} />)}
      </div>

      {/* 검색 */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
        <Input
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t("home_search_placeholder")}
          className="pl-9 pr-8"
        />
        {searchInput && (
          <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]" aria-label={t("home_search_clear")}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}</div>
      ) : posts && posts.items.length > 0 ? (
        <><div className="flex flex-col gap-4">{posts.items.map((post) => <PostCard key={post.id} post={post} />)}</div>
        <div className="mt-8"><Pagination currentPage={posts.page} totalPages={posts.totalPages} onPageChange={handlePageChange} /></div></>
      ) : hasSearch ? (
        <div className="py-20 text-center">
          <p className="text-lg text-[var(--color-text-secondary)]">{t("home_no_search_results", { query: currentSearch })}</p>
          <button onClick={clearSearch} className="mt-3 text-sm text-[var(--color-primary)] hover:underline">{t("home_search_clear")}</button>
        </div>
      ) : (
        <div className="py-20 text-center"><p className="text-lg text-[var(--color-text-secondary)]">{t("home_no_posts")}</p><p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t("home_write_first")}</p></div>
      )}
    </div>
  );
}
