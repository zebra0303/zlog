import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { FileText, Trash2, X, Loader2, Edit, Eye, EyeOff, Search, Activity } from "lucide-react";
import {
  Button,
  Input,
  Card,
  CardContent,
  Badge,
  Pagination,
  useConfirm,
  useToast,
} from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n";
import { timeAgo } from "@/shared/lib/formatDate";
import { countryFlag, countryName } from "@/shared/lib/country";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import type { PostWithCategory, PaginatedResponse, PostAccessLog } from "@zlog/shared";

function decodeReferer(referer: string): string {
  try {
    return decodeURIComponent(referer);
  } catch {
    return referer;
  }
}

type PostStatus = "all" | "published" | "draft";

export function PostManager() {
  const [posts, setPosts] = useState<PostWithCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Track fetch failure to show error UI with retry
  const [fetchError, setFetchError] = useState(false);
  const [filter, setFilter] = useState<PostStatus>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [accessLogPopover, setAccessLogPopover] = useState<string | null>(null);
  const [accessLogs, setAccessLogs] = useState<PostAccessLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  // Close popover on outside click
  useClickOutside(
    popoverRef,
    () => {
      setAccessLogPopover(null);
    },
    !!accessLogPopover,
  );

  const handleOpenAccessLogs = async (postId: string) => {
    if (accessLogPopover === postId) {
      setAccessLogPopover(null);
      return;
    }
    setAccessLogPopover(postId);
    setLogsLoading(true);
    try {
      const data = await api.get<PostAccessLog[]>(`/posts/${postId}/access-logs`);
      setAccessLogs(data);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchPosts = useCallback((status: PostStatus, pg: number, search: string) => {
    setIsLoading(true);
    setFetchError(false);
    const params = new URLSearchParams();
    params.set("status", status);
    params.set("page", String(pg));
    if (search) params.set("search", search);
    api
      .get<PaginatedResponse<PostWithCategory>>(`/posts?${params.toString()}`)
      .then((data) => {
        setPosts(data.items);
        setTotalPages(data.totalPages);
        setIsLoading(false);
      })
      .catch(() => {
        setFetchError(true);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchPosts(filter, page, debouncedSearch);
  }, [filter, page, debouncedSearch, fetchPosts]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  };

  const handleFilterChange = (status: PostStatus) => {
    setFilter(status);
    setPage(1);
  };

  const handleDelete = async (post: PostWithCategory) => {
    const isConfirmed = await confirm(
      t("admin_post_delete_confirm", { title: post.title || t("admin_post_untitled") }),
    );
    if (!isConfirmed) return;
    setDeletingId(post.id);
    try {
      await api.delete(`/posts/${post.id}`);
      showToast(t("post_deleted_success"), "success");
      fetchPosts(filter, page, debouncedSearch);
    } catch {
      showToast(t("post_delete_failed"), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const filterButtons: { key: PostStatus; label: string }[] = [
    { key: "all", label: t("admin_post_all") },
    { key: "published", label: t("admin_post_published") },
    { key: "draft", label: t("admin_post_draft") },
  ];

  return (
    <Card>
      <CardContent className="p-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
            <FileText className="h-5 w-5" />
            {t("admin_post_title")}
          </h2>
          <div className="flex rounded-lg border border-[var(--color-border)]">
            {filterButtons.map((fb) => (
              <button
                key={fb.key}
                onClick={() => {
                  handleFilterChange(fb.key);
                }}
                className={`px-3 py-1 text-xs ${filter === fb.key ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)]"} ${fb.key === "all" ? "rounded-l-lg" : fb.key === "draft" ? "rounded-r-lg" : ""}`}
              >
                {fb.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <Input
            value={searchInput}
            onChange={(e) => {
              handleSearchChange(e.target.value);
            }}
            placeholder={t("admin_post_search_placeholder")}
            className="pr-8 pl-9"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput("");
                setDebouncedSearch("");
                setPage(1);
              }}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Skeleton loading UI for post list */}
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3"
              >
                <div className="flex-1">
                  <div className="mb-1 h-5 w-2/3 animate-pulse rounded bg-[var(--color-border)]" />
                  <div className="h-3 w-1/4 animate-pulse rounded bg-[var(--color-border)]" />
                </div>
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <p className="text-sm text-[var(--color-destructive)]">{t("admin_post_load_failed")}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchPosts(filter, page, debouncedSearch);
              }}
            >
              {t("comment_retry")}
            </Button>
          </div>
        ) : posts.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
            {t("admin_post_empty")}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {posts.map((post) => (
                <div key={post.id} className="relative">
                  <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium text-[var(--color-text)]">
                          {post.title || t("admin_post_untitled")}
                        </span>
                        {post.status === "draft" ? (
                          <Badge
                            variant="outline"
                            className="border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400"
                          >
                            <EyeOff className="mr-1 h-3 w-3" />
                            {t("admin_post_draft")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Eye className="mr-1 h-3 w-3" />
                            {t("admin_post_published")}
                          </Badge>
                        )}
                        {post.category && <Badge variant="outline">{post.category.name}</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                        {timeAgo(post.updatedAt)}
                      </p>
                    </div>
                    <div className="ml-2 flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          void handleOpenAccessLogs(post.id);
                        }}
                        aria-label="View access logs"
                        aria-pressed={accessLogPopover === post.id}
                        className={
                          accessLogPopover === post.id ? "text-[var(--color-primary)]" : ""
                        }
                      >
                        <Activity className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/write/${post.id}`} aria-label={t("edit")}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(post)}
                        disabled={deletingId === post.id}
                        aria-label={t("delete")}
                      >
                        <Trash2 className="h-4 w-4 text-[var(--color-destructive)]" />
                      </Button>
                    </div>
                  </div>
                  {accessLogPopover === post.id && (
                    <div
                      ref={popoverRef}
                      className="absolute top-full right-0 z-50 mt-1 w-full min-w-[320px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg sm:w-auto sm:min-w-[480px]"
                    >
                      <div className="flex items-center justify-between gap-2 rounded-t-lg border-b border-[var(--color-border)] px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-[var(--color-primary)]" />
                          <span className="text-sm font-medium text-[var(--color-text)]">
                            Recent Visitors
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setAccessLogPopover(null);
                          }}
                          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                          aria-label="Close"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {logsLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-text-secondary)]" />
                        </div>
                      ) : accessLogs.length === 0 ? (
                        <p className="px-3 py-4 text-center text-xs text-[var(--color-text-secondary)]">
                          No access logs yet.
                        </p>
                      ) : (
                        <div className="max-h-64 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                                <th className="px-3 py-1.5 font-medium">Time</th>
                                <th className="px-3 py-1.5 font-medium">IP</th>
                                <th className="px-3 py-1.5 font-medium">OS</th>
                                <th className="px-3 py-1.5 font-medium">Browser</th>
                                <th className="px-3 py-1.5 font-medium">Referer</th>
                              </tr>
                            </thead>
                            <tbody>
                              {accessLogs.map((log) => (
                                <tr
                                  key={log.id}
                                  className="border-b border-[var(--color-border)] last:border-0"
                                >
                                  <td className="px-3 py-1.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                                    {new Date(log.createdAt).toLocaleString()}
                                  </td>
                                  <td className="px-3 py-1.5 text-[var(--color-text)]">
                                    <div className="flex items-center gap-1">
                                      {log.country && (
                                        <span
                                          title={countryName(log.country)}
                                          aria-label={countryName(log.country)}
                                          className="shrink-0 cursor-default text-base leading-none"
                                        >
                                          {countryFlag(log.country)}
                                        </span>
                                      )}
                                      <div className="w-[7.5rem] truncate" title={log.ip ?? ""}>
                                        {log.ip && log.ip !== "unknown" ? log.ip : "—"}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-1.5 whitespace-nowrap text-[var(--color-text)]">
                                    {log.os ?? "—"}
                                  </td>
                                  <td className="px-3 py-1.5 whitespace-nowrap text-[var(--color-text)]">
                                    {log.browser ?? "—"}
                                  </td>
                                  <td className="px-3 py-1.5 text-[var(--color-text-secondary)]">
                                    {log.referer ? (
                                      <div
                                        className="max-w-[160px] truncate"
                                        title={decodeReferer(log.referer)}
                                      >
                                        {decodeReferer(log.referer)}
                                      </div>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                buttonClassName="cursor-pointer"
                activeButtonClassName="!bg-[var(--color-primary)] !text-white"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
