import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { PostCard } from "@/entities/post/ui/PostCard";
import { CategoryBadge } from "@/entities/category/ui/CategoryBadge";
import { Pagination, SEOHead, Skeleton } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n";
import type { PostWithCategory, CategoryWithStats, PaginatedResponse } from "@zlog/shared";

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get("page")) || 1;
  const currentCategory = searchParams.get("category") ?? "";
  const [posts, setPosts] = useState<PaginatedResponse<PostWithCategory> | null>(null);
  const [categories, setCategories] = useState<CategoryWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => { void api.get<CategoryWithStats[]>("/categories").then(setCategories); }, []);
  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(currentPage));
    if (currentCategory) params.set("category", currentCategory);
    void api.get<PaginatedResponse<PostWithCategory>>(`/posts?${params.toString()}`).then((data) => { setPosts(data); setIsLoading(false); }).catch(() => setIsLoading(false));
  }, [currentPage, currentCategory]);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(page));
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      <SEOHead title={t("home_title")} />
      <div className="mb-6 flex flex-wrap gap-2">
        <CategoryBadge slug="all" name={t("home_all")} isActive={!currentCategory} />
        {categories.map((cat) => <CategoryBadge key={cat.id} slug={cat.slug} name={cat.name} isActive={currentCategory === cat.slug} />)}
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}</div>
      ) : posts && posts.items.length > 0 ? (
        <><div className="flex flex-col gap-4">{posts.items.map((post) => <PostCard key={post.id} post={post} />)}</div>
        <div className="mt-8"><Pagination currentPage={posts.page} totalPages={posts.totalPages} onPageChange={handlePageChange} /></div></>
      ) : (
        <div className="py-20 text-center"><p className="text-lg text-[var(--color-text-secondary)]">{t("home_no_posts")}</p><p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t("home_write_first")}</p></div>
      )}
    </div>
  );
}
