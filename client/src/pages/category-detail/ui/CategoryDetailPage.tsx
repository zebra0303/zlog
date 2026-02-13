import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Rss, Info, X, ExternalLink } from "lucide-react";
import { PostCard } from "@/entities/post/ui/PostCard";
import { Pagination, SEOHead, Skeleton, Card, CardContent, Badge, Button, Input } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { parseMarkdown } from "@/shared/lib/markdown/parser";
import { useAuthStore } from "@/features/auth/model/store";
import type { CategoryWithStats, PostWithCategory, PaginatedResponse } from "@zlog/shared";

// ============ 구독 다이얼로그 ============
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

  const callbackUrl = blogUrl.trim()
    ? `${blogUrl.trim().replace(/\/$/, "")}/api/federation/webhook`
    : "";

  const handleSubscribe = async () => {
    if (!blogUrl.trim()) {
      setResult({ type: "error", text: "블로그 URL을 입력해주세요." });
      return;
    }
    setIsSubmitting(true);
    setResult(null);
    try {
      await api.post("/federation/subscribe", {
        categoryId: category.id,
        subscriberUrl: blogUrl.trim().replace(/\/$/, ""),
        callbackUrl,
      });
      setResult({ type: "success", text: "구독이 등록되었습니다! 새 글이 발행되면 자동으로 동기화됩니다." });
    } catch (err) {
      setResult({
        type: "error",
        text: err instanceof Error ? err.message : "구독에 실패했습니다.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!blogUrl.trim()) {
      setResult({ type: "error", text: "블로그 URL을 입력해주세요." });
      return;
    }
    setIsSubmitting(true);
    setResult(null);
    try {
      await api.post("/federation/unsubscribe", {
        categoryId: category.id,
        subscriberUrl: blogUrl.trim().replace(/\/$/, ""),
      });
      setResult({ type: "success", text: "구독이 해제되었습니다." });
    } catch (err) {
      setResult({
        type: "error",
        text: err instanceof Error ? err.message : "구독 해제에 실패했습니다.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
            <Rss className="h-5 w-5 text-[var(--color-primary)]" />
            "{category.name}" 카테고리 구독
          </h2>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {/* 설명 */}
          <div className="mb-4 rounded-lg bg-[var(--color-background)] p-3">
            <div className="mb-2 flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text)]">zlog Federation 구독이란?</h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  다른 zlog 블로그를 운영하고 계신다면, 이 카테고리를 구독할 수 있습니다.
                  구독하면 이 카테고리에 새 글이 발행될 때마다 자동으로 여러분의 블로그에 동기화됩니다.
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  아래에 여러분의 블로그 URL을 입력하면, 콜백 URL이 자동 생성되어 웹훅으로 새 글 알림을 받게 됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* 입력 폼 */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">내 블로그 URL</label>
              <Input
                placeholder="https://myblog.example.com"
                value={blogUrl}
                onChange={(e) => setBlogUrl(e.target.value)}
              />
            </div>
            {callbackUrl && (
              <div>
                <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">콜백 URL (자동 생성)</label>
                <div className="flex items-center gap-2 rounded-lg bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
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
              <Button variant="outline" size="sm" onClick={handleUnsubscribe} disabled={isSubmitting || !blogUrl.trim()}>
                구독 해제
              </Button>
              <Button size="sm" onClick={handleSubscribe} disabled={isSubmitting || !blogUrl.trim()}>
                <Rss className="mr-1 h-4 w-4" />
                {isSubmitting ? "처리 중..." : "구독하기"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ 메인 페이지 ============
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
      .catch(() => setIsLoading(false));
  }, [slug, currentPage]);

  if (!category && !isLoading)
    return (
      <p className="py-20 text-center text-[var(--color-text-secondary)]">카테고리를 찾을 수 없습니다.</p>
    );

  return (
    <div>
      {category && (
        <>
          <SEOHead title={category.name} description={category.description ?? undefined} />
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="mb-2 text-2xl font-bold text-[var(--color-text)]">{category.name}</h1>
                  {category.description && (
                    <p className="mb-3 text-[var(--color-text-secondary)]">{category.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <Badge variant="secondary">{category.postCount}개 게시글</Badge>
                    <Badge variant="outline">{category.followerCount}명 구독</Badge>
                  </div>
                </div>
                {!isAuthenticated && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSubscribe(true)}
                    className="shrink-0"
                  >
                    <Rss className="mr-1 h-4 w-4" />
                    구독
                  </Button>
                )}
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
        <p className="py-10 text-center text-[var(--color-text-secondary)]">
          이 카테고리에 게시글이 없습니다.
        </p>
      )}

      {showSubscribe && category && (
        <SubscribeDialog category={category} onClose={() => setShowSubscribe(false)} />
      )}
    </div>
  );
}
