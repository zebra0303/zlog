import { useCallback, useEffect, useRef, useState } from "react";
import { useThemeStore } from "@/features/toggle-theme/model/store";
import { useNavigate, useSearchParams, Link } from "react-router";
import {
  Settings,
  FileText,
  Globe,
  Save,
  Folder,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Palette,
  Upload,
  Loader2,
  Rss,
  Languages,
  Edit,
  Eye,
  EyeOff,
  Search,
  RefreshCw,
  Link2,
  Power,
  Activity,
  ChevronDown,
} from "lucide-react";
import {
  Button,
  Input,
  Textarea,
  Card,
  CardContent,
  SEOHead,
  Badge,
  Pagination,
  ColorPicker,
} from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useAuthStore } from "@/features/auth/model/store";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";
import { useI18n } from "@/shared/i18n";
import { timeAgo } from "@/shared/lib/formatDate";
import { countryFlag, countryName } from "@/shared/lib/country";
import { VisitorStats } from "@/features/visitor-analytics/ui";
import { FONT_OPTIONS, applyFont } from "@/shared/lib/fonts";
import type {
  CategoryWithStats,
  PostWithCategory,
  PaginatedResponse,
  PostAccessLog,
} from "@zlog/shared";

function decodeReferer(referer: string): string {
  try {
    return decodeURIComponent(referer);
  } catch {
    return referer;
  }
}

// ============ Post Manager ============
type PostStatus = "all" | "published" | "draft";

function PostManager() {
  const [posts, setPosts] = useState<PostWithCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setAccessLogPopover(null);
      }
    };
    if (accessLogPopover) document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [accessLogPopover]);

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
    if (!confirm(t("admin_post_delete_confirm", { title: post.title || t("admin_post_untitled") })))
      return;
    setDeletingId(post.id);
    try {
      await api.delete(`/posts/${post.id}`);
      fetchPosts(filter, page, debouncedSearch);
    } catch {
      /* ignore */
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
      <CardContent className="pt-6">
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
              className="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isLoading ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
            {t("loading")}
          </p>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(post);
                        }}
                        disabled={deletingId === post.id}
                        aria-label={t("delete")}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
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
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============ Category Manager ============
function CategoryManager() {
  const [categories, setCategories] = useState<CategoryWithStats[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  const fetchCategories = useCallback(() => {
    void api
      .get<CategoryWithStats[]>("/categories")
      .then(setCategories)
      .catch(() => {
        setError(t("admin_cat_create_failed"));
      });
  }, [t]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      setError(t("admin_cat_name_required"));
      return;
    }
    setError(null);
    try {
      await api.post("/categories", {
        name: newName,
        description: newDesc || undefined,
        isPublic: newIsPublic,
      });
      setNewName("");
      setNewDesc("");
      setNewIsPublic(true);
      setIsAdding(false);
      fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin_cat_create_failed"));
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) {
      setError(t("admin_cat_name_required"));
      return;
    }
    setError(null);
    try {
      await api.put(`/categories/${id}`, {
        name: editName,
        description: editDesc || undefined,
        isPublic: editIsPublic,
      });
      setEditingId(null);
      fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin_cat_update_failed"));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t("admin_cat_delete_confirm", { name }))) return;
    try {
      await api.delete(`/categories/${id}`);
      fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin_cat_delete_failed"));
    }
  };

  const startEdit = (cat: CategoryWithStats) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description ?? "");
    setEditIsPublic(cat.isPublic);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
            <Folder className="h-5 w-5" />
            {t("admin_cat_title")}
          </h2>
          {!isAdding && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAdding(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("admin_cat_add")}
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20">
            {error}
          </div>
        )}

        {isAdding && (
          <div className="mb-4 rounded-lg border border-[var(--color-primary)] bg-[var(--color-surface)] p-4">
            <h3 className="mb-3 text-sm font-medium text-[var(--color-text)]">
              {t("admin_cat_new")}
            </h3>
            <div className="flex flex-col gap-3">
              <Input
                placeholder={t("admin_cat_name_placeholder")}
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                }}
                autoFocus
              />
              <Input
                placeholder={t("admin_cat_desc_placeholder")}
                value={newDesc}
                onChange={(e) => {
                  setNewDesc(e.target.value);
                }}
              />
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--color-text)]">{t("public")}</label>
                <button
                  role="switch"
                  aria-checked={newIsPublic}
                  onClick={() => {
                    setNewIsPublic(!newIsPublic);
                  }}
                  className={`relative h-6 w-11 rounded-full transition-colors ${newIsPublic ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${newIsPublic ? "left-[22px]" : "left-0.5"}`}
                  />
                </button>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsAdding(false);
                    setNewName("");
                    setNewDesc("");
                    setError(null);
                  }}
                >
                  {t("cancel")}
                </Button>
                <Button size="sm" onClick={handleCreate}>
                  {t("create")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {categories.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
            {t("admin_cat_empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {categories.map((cat) => (
              <div key={cat.id} className="rounded-lg border border-[var(--color-border)] p-3">
                {editingId === cat.id ? (
                  <div className="flex flex-col gap-3">
                    <Input
                      value={editName}
                      onChange={(e) => {
                        setEditName(e.target.value);
                      }}
                      autoFocus
                    />
                    <Input
                      placeholder={t("admin_cat_desc_placeholder")}
                      value={editDesc}
                      onChange={(e) => {
                        setEditDesc(e.target.value);
                      }}
                    />
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-[var(--color-text)]">{t("public")}</label>
                      <button
                        role="switch"
                        aria-checked={editIsPublic}
                        onClick={() => {
                          setEditIsPublic(!editIsPublic);
                        }}
                        className={`relative h-6 w-11 rounded-full transition-colors ${editIsPublic ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${editIsPublic ? "left-[22px]" : "left-0.5"}`}
                        />
                      </button>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(null);
                          setError(null);
                        }}
                      >
                        <X className="mr-1 h-3 w-3" />
                        {t("cancel")}
                      </Button>
                      <Button size="sm" onClick={() => handleUpdate(cat.id)}>
                        <Check className="mr-1 h-3 w-3" />
                        {t("save")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--color-text)]">{cat.name}</span>
                        <Badge variant="secondary">
                          {cat.postCount.toLocaleString()} {t("admin_cat_posts_count")}
                        </Badge>
                        {!cat.isPublic && <Badge variant="outline">{t("private")}</Badge>}
                      </div>
                      {cat.description && (
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          {cat.description}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                        /{cat.slug}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          startEdit(cat);
                        }}
                        aria-label={t("edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(cat.id, cat.name);
                        }}
                        aria-label={t("delete")}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ Image Upload Input ============
function ImageUploadInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (url: string) => void;
  placeholder: string;
}) {
  const [uploading, setUploading] = useState(false);
  const { t } = useI18n();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await api.upload<{ url: string }>("/upload/image", fd);
      onChange(res.url);
    } catch {
      /* ignore */
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div>
      <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
        {t("admin_theme_bg_image")}
      </label>
      <div className="flex items-center gap-2">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className="flex-1 text-xs"
        />
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-background)]">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          {uploading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          {uploading ? t("uploading") : t("upload")}
        </label>
        {value && (
          <button
            onClick={() => {
              onChange("");
            }}
            className="text-xs text-red-500 hover:underline"
          >
            {t("reset")}
          </button>
        )}
      </div>
    </div>
  );
}

// ============ Theme Customizer ============
interface ThemeSection {
  title: string;
  heightKey: string | null;
  keys: {
    lightColor: string;
    darkColor: string;
    lightImage?: string;
    darkImage?: string;
    lightAlign?: string;
    darkAlign?: string;
    lightGradientTo?: string;
    darkGradientTo?: string;
    lightGradientDir?: string;
    darkGradientDir?: string;
    lightGradientMid?: string;
    darkGradientMid?: string;
  };
}

const GRADIENT_DIRECTIONS = [
  { value: "to bottom", label: "↓ Top → Bottom" },
  { value: "to right", label: "→ Left → Right" },
  { value: "to bottom right", label: "↘ Top-Left → Bottom-Right" },
  { value: "to bottom left", label: "↙ Top-Right → Bottom-Left" },
];

function ThemeCustomizer({
  settings,
  update,
}: {
  settings: Record<string, string>;
  update: (k: string, v: string) => void;
}) {
  const { t } = useI18n();

  const heightOptions = [
    { value: "auto", label: t("admin_theme_auto") },
    { value: "80px", label: "80px" },
    { value: "100px", label: "100px" },
    { value: "120px", label: "120px" },
    { value: "160px", label: "160px" },
    { value: "200px", label: "200px" },
    { value: "250px", label: "250px" },
  ];

  const sections: ThemeSection[] = [
    {
      title: t("admin_theme_header"),
      heightKey: "header_height",
      keys: {
        lightColor: "header_bg_color_light",
        darkColor: "header_bg_color_dark",
        lightImage: "header_bg_image_light",
        darkImage: "header_bg_image_dark",
        lightAlign: "header_image_alignment_light",
        darkAlign: "header_image_alignment_dark",
      },
    },
    {
      title: t("admin_theme_footer"),
      heightKey: "footer_height",
      keys: {
        lightColor: "footer_bg_color_light",
        darkColor: "footer_bg_color_dark",
        lightImage: "footer_bg_image_light",
        darkImage: "footer_bg_image_dark",
        lightAlign: "footer_image_alignment_light",
        darkAlign: "footer_image_alignment_dark",
      },
    },
    {
      title: t("admin_theme_body"),
      heightKey: null,
      keys: {
        lightColor: "body_bg_color_light",
        darkColor: "body_bg_color_dark",
        lightGradientTo: "body_bg_gradient_to_light",
        darkGradientTo: "body_bg_gradient_to_dark",
        lightGradientDir: "body_bg_gradient_direction_light",
        darkGradientDir: "body_bg_gradient_direction_dark",
        lightGradientMid: "body_bg_gradient_midpoint_light",
        darkGradientMid: "body_bg_gradient_midpoint_dark",
      },
    },
  ];

  const renderColorRow = (colorKey: string, placeholder: string) => (
    <div>
      <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
        {t("admin_theme_bg_color")}
      </label>
      <div className="flex items-center gap-2">
        <ColorPicker
          value={settings[colorKey] ?? placeholder}
          onChange={(color) => {
            update(colorKey, color);
          }}
        />
        <Input
          placeholder={placeholder}
          value={settings[colorKey] ?? ""}
          onChange={(e) => {
            update(colorKey, e.target.value);
          }}
          className="flex-1 text-xs"
        />
        {settings[colorKey] && (
          <button
            onClick={() => {
              update(colorKey, "");
            }}
            className="text-xs text-red-500 hover:underline"
          >
            {t("reset")}
          </button>
        )}
      </div>
    </div>
  );

  // Renders end color + direction fields (toggle is in the panel header)
  const renderGradientFields = (
    gradientToKey: string,
    gradientDirKey: string,
    gradientMidKey?: string,
  ) => {
    if (!settings[gradientToKey]) return null;
    return (
      <>
        <div>
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            {t("admin_theme_gradient_end_color")}
          </label>
          <div className="flex items-center gap-2">
            <ColorPicker
              value={settings[gradientToKey] ?? ""}
              onChange={(color) => {
                update(gradientToKey, color);
              }}
            />
            <Input
              value={settings[gradientToKey] ?? ""}
              onChange={(e) => {
                update(gradientToKey, e.target.value);
              }}
              className="flex-1 text-xs"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            {t("admin_theme_gradient_direction")}
          </label>
          <select
            value={settings[gradientDirKey] ?? "to bottom"}
            onChange={(e) => {
              update(gradientDirKey, e.target.value);
            }}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text)]"
          >
            {GRADIENT_DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        {gradientMidKey && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-[var(--color-text-secondary)]">
                {t("admin_theme_gradient_midpoint")}
              </label>
              <span className="text-xs font-medium text-[var(--color-text)]">
                {settings[gradientMidKey] ?? "50"}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={settings[gradientMidKey] ?? "50"}
              onChange={(e) => {
                update(gradientMidKey, e.target.value);
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[var(--color-border)] accent-[var(--color-primary)]"
            />
          </div>
        )}
      </>
    );
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
          <Palette className="h-5 w-5" />
          {t("admin_theme_title")}
        </h2>
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">{t("admin_theme_desc")}</p>

        {/* Font Selection */}
        <div className="mb-6 rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="mb-1 font-medium text-[var(--color-text)]">{t("admin_theme_font")}</h3>
          <div className="flex flex-col gap-2">
            <select
              value={settings.font_family ?? "system"}
              onChange={(e) => {
                const val = e.target.value;
                update("font_family", val);
                applyFont(val);
              }}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Primary theme color */}
        <div className="mb-6 rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="mb-1 font-medium text-[var(--color-text)]">
            {t("admin_theme_primary_color")}
          </h3>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
            {t("admin_theme_primary_color_desc")}
          </p>
          <div className="flex items-center gap-2">
            <ColorPicker
              // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
              value={settings.primary_color || "#6c5ce7"}
              onChange={(color) => {
                update("primary_color", color);
              }}
            />
            <Input
              placeholder="#6c5ce7"
              value={settings.primary_color ?? ""}
              onChange={(e) => {
                update("primary_color", e.target.value);
              }}
              className="flex-1 text-xs"
            />
            {settings.primary_color && (
              <button
                onClick={() => {
                  update("primary_color", "");
                }}
                className="text-xs text-red-500 hover:underline"
              >
                {t("reset")}
              </button>
            )}
          </div>
          {settings.primary_color && (
            <div
              className="mt-2 h-8 rounded border border-[var(--color-border)]"
              style={{ backgroundColor: settings.primary_color }}
            />
          )}
        </div>

        {/* Surface & Text Colors */}
        <div className="mb-6 rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="mb-1 font-medium text-[var(--color-text)]">
            {t("admin_theme_surface_text")}
          </h3>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
            {t("admin_theme_surface_text_desc")}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Light Mode */}
            <div className="rounded-lg bg-[var(--color-background)] p-3">
              <h4 className="mb-2 text-sm font-medium text-[var(--color-text)]">
                {t("admin_theme_light_mode")}
              </h4>
              <div className="flex flex-col gap-2">
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                    {t("admin_theme_surface_color")}
                  </label>
                  <div className="flex items-center gap-2">
                    <ColorPicker
                      value={settings.surface_color_light ?? "#ffffff"}
                      onChange={(color) => {
                        update("surface_color_light", color);
                      }}
                    />
                    <Input
                      placeholder="#ffffff"
                      value={settings.surface_color_light ?? ""}
                      onChange={(e) => {
                        update("surface_color_light", e.target.value);
                      }}
                      className="flex-1 text-xs"
                    />
                    {settings.surface_color_light && (
                      <button
                        onClick={() => {
                          update("surface_color_light", "");
                        }}
                        className="text-xs text-red-500 hover:underline"
                      >
                        {t("reset")}
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                    {t("admin_theme_text_color")}
                  </label>
                  <div className="flex items-center gap-2">
                    <ColorPicker
                      value={settings.text_color_light ?? "#1a1a2e"}
                      onChange={(color) => {
                        update("text_color_light", color);
                      }}
                    />
                    <Input
                      placeholder="#1a1a2e"
                      value={settings.text_color_light ?? ""}
                      onChange={(e) => {
                        update("text_color_light", e.target.value);
                      }}
                      className="flex-1 text-xs"
                    />
                    {settings.text_color_light && (
                      <button
                        onClick={() => {
                          update("text_color_light", "");
                        }}
                        className="text-xs text-red-500 hover:underline"
                      >
                        {t("reset")}
                      </button>
                    )}
                  </div>
                </div>
                {(settings.surface_color_light ?? settings.text_color_light) && (
                  <div
                    className="mt-1 rounded border border-[var(--color-border)] p-3"
                    style={{
                      backgroundColor: settings.surface_color_light ?? "#ffffff",
                      color: settings.text_color_light ?? "#1a1a2e",
                    }}
                  >
                    <span className="text-xs font-medium">Aa</span>
                  </div>
                )}
              </div>
            </div>
            {/* Dark Mode */}
            <div className="rounded-lg bg-[var(--color-background)] p-3">
              <h4 className="mb-2 text-sm font-medium text-[var(--color-text)]">
                {t("admin_theme_dark_mode")}
              </h4>
              <div className="flex flex-col gap-2">
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                    {t("admin_theme_surface_color")}
                  </label>
                  <div className="flex items-center gap-2">
                    <ColorPicker
                      value={settings.surface_color_dark ?? "#1a1a24"}
                      onChange={(color) => {
                        update("surface_color_dark", color);
                      }}
                    />
                    <Input
                      placeholder="#1a1a24"
                      value={settings.surface_color_dark ?? ""}
                      onChange={(e) => {
                        update("surface_color_dark", e.target.value);
                      }}
                      className="flex-1 text-xs"
                    />
                    {settings.surface_color_dark && (
                      <button
                        onClick={() => {
                          update("surface_color_dark", "");
                        }}
                        className="text-xs text-red-500 hover:underline"
                      >
                        {t("reset")}
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                    {t("admin_theme_text_color")}
                  </label>
                  <div className="flex items-center gap-2">
                    <ColorPicker
                      value={settings.text_color_dark ?? "#f0f0f5"}
                      onChange={(color) => {
                        update("text_color_dark", color);
                      }}
                    />
                    <Input
                      placeholder="#f0f0f5"
                      value={settings.text_color_dark ?? ""}
                      onChange={(e) => {
                        update("text_color_dark", e.target.value);
                      }}
                      className="flex-1 text-xs"
                    />
                    {settings.text_color_dark && (
                      <button
                        onClick={() => {
                          update("text_color_dark", "");
                        }}
                        className="text-xs text-red-500 hover:underline"
                      >
                        {t("reset")}
                      </button>
                    )}
                  </div>
                </div>
                {(settings.surface_color_dark ?? settings.text_color_dark) && (
                  <div
                    className="mt-1 rounded border border-[var(--color-border)] p-3"
                    style={{
                      backgroundColor: settings.surface_color_dark ?? "#1a1a24",
                      color: settings.text_color_dark ?? "#f0f0f5",
                    }}
                  >
                    <span className="text-xs font-medium">Aa</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {sections.map((section) => {
            const { heightKey } = section;
            const {
              lightColor,
              darkColor,
              lightImage,
              darkImage,
              lightAlign,
              darkAlign,
              lightGradientTo,
              darkGradientTo,
              lightGradientDir,
              darkGradientDir,
              lightGradientMid,
              darkGradientMid,
            } = section.keys;

            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            const showLightPreview = settings[lightColor] || (lightImage && settings[lightImage]);
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            const showDarkPreview = settings[darkColor] || (darkImage && settings[darkImage]);

            const lAlign = lightAlign;
            const dAlign = darkAlign;

            return (
              <div
                key={section.title}
                className="rounded-lg border border-[var(--color-border)] p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-medium text-[var(--color-text)]">{section.title}</h3>
                  {heightKey !== null && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[var(--color-text-secondary)]">
                        {t("admin_theme_height")}
                      </label>
                      <select
                        value={settings[heightKey] ?? "auto"}
                        onChange={(e) => {
                          update(heightKey, e.target.value);
                        }}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text)]"
                      >
                        {heightOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Light Mode */}
                  <div className="rounded-lg bg-[var(--color-background)] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-medium text-[var(--color-text)]">
                        {t("admin_theme_light_mode")}
                      </h4>
                      {/* Gradient toggle in header (body section only) */}
                      {lightGradientTo !== undefined && lightGradientDir !== undefined && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[var(--color-text-secondary)]">
                            {t("admin_theme_gradient")}
                          </span>
                          <button
                            role="switch"
                            aria-checked={!!settings[lightGradientTo]}
                            onClick={() => {
                              if (settings[lightGradientTo]) {
                                update(lightGradientTo, "");
                                update(lightGradientDir, "");
                                if (lightGradientMid) update(lightGradientMid, "");
                              } else {
                                update(lightGradientTo, "#000000");
                                update(lightGradientDir, "to bottom");
                                if (lightGradientMid) update(lightGradientMid, "50");
                              }
                            }}
                            className={`relative h-5 w-9 rounded-full transition-colors ${
                              settings[lightGradientTo]
                                ? "bg-[var(--color-primary)]"
                                : "bg-[var(--color-border)]"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                                settings[lightGradientTo] ? "left-[18px]" : "left-0.5"
                              }`}
                            />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {renderColorRow(lightColor, "#ffffff")}
                      {lightImage !== undefined && (
                        <ImageUploadInput
                          value={settings[lightImage] ?? ""}
                          onChange={(url) => {
                            update(lightImage, url);
                          }}
                          placeholder={t("admin_theme_image_placeholder")}
                        />
                      )}
                      {lightImage && lAlign && settings[lightImage] && (
                        <div>
                          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                            {t("admin_theme_alignment")}
                          </label>
                          <div className="flex overflow-hidden rounded-lg border border-[var(--color-border)]">
                            {["left", "center", "right"].map((pos) => (
                              <button
                                key={pos}
                                onClick={() => {
                                  update(lAlign, pos);
                                }}
                                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors ${
                                  (settings[lAlign] ?? "left") === pos
                                    ? "bg-[var(--color-primary)] text-white"
                                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
                                }`}
                              >
                                {t(`admin_theme_align_${pos as "left" | "center" | "right"}`)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {lightGradientTo !== undefined &&
                        lightGradientDir !== undefined &&
                        renderGradientFields(lightGradientTo, lightGradientDir, lightGradientMid)}
                      {/* Preview */}
                      {showLightPreview && (
                        <div
                          className="mt-1 h-12 rounded border border-[var(--color-border)]"
                          style={
                            lightGradientTo && settings[lightGradientTo]
                              ? {
                                  background: `linear-gradient(${settings[lightGradientDir ?? ""] ?? "to bottom"}, ${settings[lightColor]} ${lightGradientMid && settings[lightGradientMid] ? settings[lightGradientMid] + "%" : ""}, ${settings[lightGradientTo]})`,
                                }
                              : {
                                  backgroundColor: settings[lightColor] ?? undefined,
                                  backgroundImage:
                                    lightImage && settings[lightImage]
                                      ? `url(${settings[lightImage]})`
                                      : undefined,
                                  backgroundSize: "cover",
                                  backgroundPosition: `${(lAlign && settings[lAlign]) ?? "left"} center`,
                                }
                          }
                        />
                      )}
                    </div>
                  </div>
                  {/* Dark Mode */}
                  <div className="rounded-lg bg-[var(--color-background)] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-medium text-[var(--color-text)]">
                        {t("admin_theme_dark_mode")}
                      </h4>
                      {/* Gradient toggle in header (body section only) */}
                      {darkGradientTo !== undefined && darkGradientDir !== undefined && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[var(--color-text-secondary)]">
                            {t("admin_theme_gradient")}
                          </span>
                          <button
                            role="switch"
                            aria-checked={!!settings[darkGradientTo]}
                            onClick={() => {
                              if (settings[darkGradientTo]) {
                                update(darkGradientTo, "");
                                update(darkGradientDir, "");
                                if (darkGradientMid) update(darkGradientMid, "");
                              } else {
                                update(darkGradientTo, "#ffffff");
                                update(darkGradientDir, "to bottom");
                                if (darkGradientMid) update(darkGradientMid, "50");
                              }
                            }}
                            className={`relative h-5 w-9 rounded-full transition-colors ${
                              settings[darkGradientTo]
                                ? "bg-[var(--color-primary)]"
                                : "bg-[var(--color-border)]"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                                settings[darkGradientTo] ? "left-[18px]" : "left-0.5"
                              }`}
                            />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {renderColorRow(darkColor, "#1a1a24")}
                      {darkImage !== undefined && (
                        <ImageUploadInput
                          value={settings[darkImage] ?? ""}
                          onChange={(url) => {
                            update(darkImage, url);
                          }}
                          placeholder={t("admin_theme_image_placeholder")}
                        />
                      )}
                      {darkImage && dAlign && settings[darkImage] && (
                        <div>
                          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                            {t("admin_theme_alignment")}
                          </label>
                          <div className="flex overflow-hidden rounded-lg border border-[var(--color-border)]">
                            {["left", "center", "right"].map((pos) => (
                              <button
                                key={pos}
                                onClick={() => {
                                  update(dAlign, pos);
                                }}
                                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors ${
                                  (settings[dAlign] ?? "left") === pos
                                    ? "bg-[var(--color-primary)] text-white"
                                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
                                }`}
                              >
                                {t(`admin_theme_align_${pos as "left" | "center" | "right"}`)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {darkGradientTo !== undefined &&
                        darkGradientDir !== undefined &&
                        renderGradientFields(darkGradientTo, darkGradientDir, darkGradientMid)}
                      {/* Preview */}
                      {showDarkPreview && (
                        <div
                          className="mt-1 h-12 rounded border border-[var(--color-border)]"
                          style={
                            darkGradientTo && settings[darkGradientTo]
                              ? {
                                  background: `linear-gradient(${settings[darkGradientDir ?? ""] ?? "to bottom"}, ${settings[darkColor]} ${darkGradientMid && settings[darkGradientMid] ? settings[darkGradientMid] + "%" : ""}, ${settings[darkGradientTo]})`,
                                }
                              : {
                                  backgroundColor: settings[darkColor] ?? undefined,
                                  backgroundImage:
                                    darkImage && settings[darkImage]
                                      ? `url(${settings[darkImage]})`
                                      : undefined,
                                  backgroundSize: "cover",
                                  backgroundPosition: `${(dAlign && settings[dAlign]) ?? "left"} center`,
                                }
                          }
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ Subscription Manager (categories I'm subscribed to) ============
interface MySubscription {
  id: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  localCategoryId: string;
  localCategoryName: string;
  localCategorySlug: string;
  remoteCategoryId: string;
  remoteCategoryName: string;
  remoteCategoryRemoteId: string;
  remoteBlogId: string;
  remoteBlogSiteUrl: string;
  remoteBlogTitle: string | null;
  remoteBlogDisplayName: string | null;
}

interface RemoteCategoryOption {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

interface SubscribeActionParams {
  remoteUrl: string;
  remoteCatId: string;
  remoteCatName: string;
  remoteCatSlug: string;
}

function SubscriptionManager({
  subscribeAction,
}: {
  subscribeAction?: SubscribeActionParams | null;
}) {
  const [subs, setSubs] = useState<MySubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<{
    id: string;
    text: string;
    type: "success" | "error";
  } | null>(null);
  const { t, locale } = useI18n();
  const sectionRef = useRef<HTMLDivElement>(null);
  const localCatSelectRef = useRef<HTMLSelectElement>(null);

  // Add subscription form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [isFetchingCats, setIsFetchingCats] = useState(false);
  const [remoteCats, setRemoteCats] = useState<RemoteCategoryOption[]>([]);
  const [localCats, setLocalCats] = useState<CategoryWithStats[]>([]);
  const [selectedRemoteCat, setSelectedRemoteCat] = useState("");
  const [selectedLocalCat, setSelectedLocalCat] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [addMessage, setAddMessage] = useState<{ text: string; type: "success" | "error" } | null>(
    null,
  );

  const fetchSubs = () => {
    setIsLoading(true);
    void api
      .get<MySubscription[]>("/federation/subscriptions")
      .then((data) => {
        setSubs(data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchSubs();
  }, []);

  // Local category list (when form is opened)
  useEffect(() => {
    if (showAddForm && localCats.length === 0) {
      void api.get<CategoryWithStats[]>("/categories").then(setLocalCats);
    }
  }, [showAddForm, localCats.length]);

  // Auto-open via subscribeAction
  const actionProcessed = useRef(false);
  useEffect(() => {
    if (!subscribeAction || actionProcessed.current) return;
    actionProcessed.current = true;
    setShowAddForm(true);
    let url = subscribeAction.remoteUrl;
    if (!url.startsWith("http")) {
      if (url.startsWith("localhost") || url.startsWith("127.0.0.1")) {
        url = `http://${url}`;
      } else {
        url = `https://${url}`;
      }
    }
    url = url.replace(/\/+$/, "");
    setAddUrl(url);
    // Automatically fetch categories
    setIsFetchingCats(true);
    setAddMessage(null);
    setRemoteCats([]);
    void api
      .get<RemoteCategoryOption[]>(`/federation/remote-categories?url=${encodeURIComponent(url)}`)
      .then((cats) => {
        if (cats.length > 0) {
          setRemoteCats(cats);
          // Select category matching remoteCatId
          const match = cats.find((c) => c.id === subscribeAction.remoteCatId);
          if (match) setSelectedRemoteCat(match.id);
        } else {
          setAddMessage({ text: t("admin_mysub_add_fetch_failed"), type: "error" });
        }
      })
      .catch((err: unknown) => {
        let text = t("admin_mysub_add_fetch_failed");
        if (err instanceof Error) {
          if (err.message.startsWith("ERR_")) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
            text = t(err.message.toLowerCase() as any);
          } else {
            text = err.message;
          }
        }
        if (!text) text = t("admin_mysub_add_fetch_failed");
        setAddMessage({ text, type: "error" });
      })
      .finally(() => {
        setIsFetchingCats(false);
        // Scroll to subscription management section + focus local category
        setTimeout(() => {
          sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => {
            localCatSelectRef.current?.focus();
          }, 500);
        }, 100);
      });
  }, [subscribeAction, t]);

  const handleFetchRemoteCategories = async () => {
    let url = addUrl.trim();
    if (!url) return;
    // URL normalization
    if (!url.startsWith("http")) {
      if (url.startsWith("localhost") || url.startsWith("127.0.0.1")) {
        url = `http://${url}`;
      } else {
        url = `https://${url}`;
      }
    }
    url = url.replace(/\/+$/, "");
    setAddUrl(url);
    setIsFetchingCats(true);
    setAddMessage(null);
    setRemoteCats([]);
    setSelectedRemoteCat("");
    try {
      const cats = await api.get<RemoteCategoryOption[]>(
        `/federation/remote-categories?url=${encodeURIComponent(url)}`,
      );
      if (cats.length === 0) {
        setAddMessage({ text: t("admin_mysub_add_fetch_failed"), type: "error" });
      } else {
        setRemoteCats(cats);
      }
    } catch (err: unknown) {
      let text = t("admin_mysub_add_fetch_failed");
      if (err instanceof Error) {
        if (err.message.startsWith("ERR_")) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
          text = t(err.message.toLowerCase() as any);
        } else {
          text = err.message;
        }
      }
      if (!text) text = t("admin_mysub_add_fetch_failed");
      setAddMessage({ text, type: "error" });
    } finally {
      setIsFetchingCats(false);
    }
  };

  const handleAddSubscribe = async () => {
    if (!selectedRemoteCat || !selectedLocalCat) {
      setAddMessage({ text: t("admin_mysub_add_select_both"), type: "error" });
      return;
    }
    const remoteCat = remoteCats.find((c) => c.id === selectedRemoteCat);
    if (!remoteCat) return;
    const localCat = localCats.find((c) => c.slug === selectedLocalCat);
    if (!localCat) return;

    const remoteSiteUrl = addUrl.trim().replace(/\/+$/, "");

    setIsSubscribing(true);
    setAddMessage(null);
    try {
      // Server handles both local subscription + remote blog subscriber registration
      await api.post("/federation/local-subscribe", {
        remoteSiteUrl,
        remoteCategoryId: remoteCat.id,
        remoteCategoryName: remoteCat.name,
        remoteCategorySlug: remoteCat.slug,
        localCategorySlug: localCat.slug,
      });
      setAddMessage({ text: t("admin_mysub_add_success"), type: "success" });
      // Reset
      setAddUrl("");
      setRemoteCats([]);
      setSelectedRemoteCat("");
      setSelectedLocalCat("");
      setShowAddForm(false);
      fetchSubs();
    } catch (err: unknown) {
      let text = t("admin_mysub_add_subscribe_failed");
      if (err instanceof Error) {
        if (err.message.startsWith("ERR_")) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
          text = t(err.message.toLowerCase() as any);
        } else {
          text = err.message;
        }
      }
      if (!text) text = t("admin_mysub_add_subscribe_failed");
      setAddMessage({ text, type: "error" });
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSync = async (sub: MySubscription) => {
    setSyncingId(sub.id);
    setSyncMessage(null);
    try {
      const res = await api.post<{ syncedCount: number; lastSyncedAt: string }>(
        `/federation/subscriptions/${sub.id}/sync`,
        {},
      );
      setSyncMessage({
        id: sub.id,
        text: t("admin_mysub_sync_success", { count: String(res.syncedCount) }),
        type: "success",
      });
      fetchSubs();
    } catch (err: unknown) {
      let text = t("admin_mysub_sync_failed");
      if (err instanceof Error) {
        if (err.message.startsWith("ERR_")) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
          text = t(err.message.toLowerCase() as any);
        } else {
          text = err.message;
        }
      }
      if (!text) text = t("admin_mysub_sync_failed");
      setSyncMessage({ id: sub.id, text, type: "error" });
    } finally {
      setSyncingId(null);
    }
  };

  const handleToggleActive = async (sub: MySubscription) => {
    try {
      await api.put(`/federation/subscriptions/${sub.id}/toggle`);
      fetchSubs();
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (sub: MySubscription) => {
    const name = sub.remoteCategoryName;
    const url = sub.remoteBlogSiteUrl;
    if (!confirm(t("admin_mysub_delete_confirm", { name, url }))) return;
    try {
      await api.delete(`/federation/subscriptions/${sub.id}`);
      fetchSubs();
    } catch {
      /* ignore */
    }
  };

  return (
    <Card ref={sectionRef}>
      <CardContent className="pt-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
            <Link2 className="h-5 w-5" />
            {t("admin_mysub_title")}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowAddForm((v) => !v);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("admin_mysub_add")}
          </Button>
        </div>
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">{t("admin_mysub_desc")}</p>

        {/* Add subscription form */}
        {showAddForm && (
          <div className="mb-4 rounded-lg border border-[var(--color-primary)] bg-[var(--color-surface)] p-4">
            <div className="flex flex-col gap-3">
              {/* Step 1: URL input + fetch categories */}
              <div className="flex gap-2">
                <Input
                  value={addUrl}
                  onChange={(e) => {
                    setAddUrl(e.target.value);
                  }}
                  placeholder={t("admin_mysub_add_url_placeholder")}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleFetchRemoteCategories();
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFetchRemoteCategories}
                  disabled={isFetchingCats || !addUrl.trim()}
                >
                  {isFetchingCats ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      {t("admin_mysub_add_fetching")}
                    </>
                  ) : (
                    t("admin_mysub_add_fetch")
                  )}
                </Button>
              </div>

              {/* Step 2: Select remote category + local category */}
              {remoteCats.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-text)]">
                      {t("admin_mysub_add_remote_cat")}
                    </label>
                    <select
                      value={selectedRemoteCat}
                      onChange={(e) => {
                        setSelectedRemoteCat(e.target.value);
                      }}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                    >
                      <option value="">--</option>
                      {remoteCats.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-text)]">
                      {t("admin_mysub_add_local_cat")}
                    </label>
                    <select
                      ref={localCatSelectRef}
                      value={selectedLocalCat}
                      onChange={(e) => {
                        setSelectedLocalCat(e.target.value);
                      }}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                    >
                      <option value="">--</option>
                      {localCats.map((c) => (
                        <option key={c.id} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Step 3: Subscribe button */}
              {remoteCats.length > 0 && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleAddSubscribe} disabled={isSubscribing}>
                    {isSubscribing ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        {t("admin_mysub_add_subscribing")}
                      </>
                    ) : (
                      t("admin_mysub_add_subscribe")
                    )}
                  </Button>
                </div>
              )}

              {addMessage && (
                <p
                  className={`text-xs ${addMessage.type === "success" ? "text-green-600" : "text-red-500"}`}
                >
                  {addMessage.text}
                </p>
              )}
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
            {t("loading")}
          </p>
        ) : subs.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
            {t("admin_mysub_empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {subs.map((sub) => (
              <div key={sub.id} className="rounded-lg border border-[var(--color-border)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-text)]">
                        {sub.remoteBlogTitle ?? sub.remoteBlogDisplayName ?? sub.remoteBlogSiteUrl}
                      </span>
                      <Badge variant="secondary">{sub.remoteCategoryName}</Badge>
                      <span className="text-xs text-[var(--color-text-secondary)]">→</span>
                      <Badge variant="outline">{sub.localCategoryName}</Badge>
                      {!sub.isActive && (
                        <Badge variant="outline" className="border-red-300 text-red-500">
                          {t("admin_mysub_inactive")}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--color-text-secondary)]">
                      <span>
                        {t("admin_mysub_remote_blog")} {sub.remoteBlogSiteUrl}
                      </span>
                      <span>
                        {t("admin_mysub_last_synced")}{" "}
                        {sub.lastSyncedAt
                          ? new Date(sub.lastSyncedAt).toLocaleString(
                              locale === "ko" ? "ko-KR" : "en-US",
                            )
                          : t("admin_mysub_never_synced")}
                      </span>
                    </div>
                    {syncMessage?.id === sub.id && (
                      <p
                        className={`mt-1 text-xs ${syncMessage.type === "success" ? "text-green-600" : "text-red-500"}`}
                      >
                        {syncMessage.text}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {sub.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(sub)}
                        disabled={syncingId === sub.id}
                      >
                        <RefreshCw
                          className={`mr-1 h-3 w-3 ${syncingId === sub.id ? "animate-spin" : ""}`}
                        />
                        {syncingId === sub.id ? t("admin_mysub_syncing") : t("admin_mysub_sync")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(sub)}
                      aria-label={
                        sub.isActive ? t("admin_mysub_deactivate") : t("admin_mysub_activate")
                      }
                      title={sub.isActive ? t("admin_mysub_deactivate") : t("admin_mysub_activate")}
                    >
                      <Power
                        className={`h-4 w-4 ${sub.isActive ? "text-green-500" : "text-[var(--color-text-secondary)]"}`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(sub);
                      }}
                      aria-label={t("delete")}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ Subscriber Manager ============
interface Subscriber {
  id: string;
  categoryId: string;
  categoryName: string | null;
  subscriberUrl: string;
  callbackUrl: string;
  isActive: boolean;
  createdAt: string;
}

function SubscriberManager() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { t, locale } = useI18n();

  const fetchSubscribers = () => {
    setIsLoading(true);
    void api
      .get<Subscriber[]>("/federation/subscribers")
      .then((data) => {
        setSubscribers(data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const handleDelete = async (sub: Subscriber) => {
    if (!confirm(t("admin_sub_delete_confirm", { url: sub.subscriberUrl }))) return;
    setDeletingId(sub.id);
    try {
      await api.delete(`/federation/subscribers/${sub.id}`);
      fetchSubscribers();
    } catch {
      /* ignore */
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
          <Rss className="h-5 w-5" />
          {t("admin_sub_title")}
        </h2>
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">{t("admin_sub_desc")}</p>

        {isLoading ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
            {t("admin_sub_loading")}
          </p>
        ) : subscribers.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
            {t("admin_sub_empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {subscribers.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      {sub.subscriberUrl}
                    </span>
                    <Badge variant="secondary">
                      {sub.categoryName ?? t("admin_sub_deleted_cat")}
                    </Badge>
                    {!sub.isActive && <Badge variant="outline">{t("admin_sub_inactive")}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                    {t("admin_sub_callback")} {sub.callbackUrl}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("admin_sub_date")}{" "}
                    {new Date(sub.createdAt).toLocaleDateString(
                      locale === "ko" ? "ko-KR" : "en-US",
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(sub);
                  }}
                  disabled={deletingId === sub.id}
                  aria-label={t("delete")}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ Main AdminPage ============
type AdminTab = "general" | "content" | "theme" | "federation";

export default function AdminPage() {
  const { isAuthenticated } = useAuthStore();
  const { fetchSettings: refreshSiteSettings, getCurrentFont } = useSiteSettingsStore();
  const { isDark } = useThemeStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [testingSlack, setTestingSlack] = useState(false);
  const [slackTestResult, setSlackTestResult] = useState<"ok" | "error" | null>(null);

  // Restore font on unmount
  useEffect(() => {
    return () => {
      // Re-apply the font from the store (last saved state) when leaving admin page
      const currentFont = getCurrentFont();
      applyFont(currentFont);
    };
  }, [getCurrentFont]);

  // Live preview: apply body background, primary color, and CSS variable overrides as settings change
  useEffect(() => {
    if (Object.keys(settings).length === 0) return;

    const from = isDark ? settings.body_bg_color_dark : settings.body_bg_color_light;
    const to = isDark ? settings.body_bg_gradient_to_dark : settings.body_bg_gradient_to_light;
    const dir = isDark
      ? settings.body_bg_gradient_direction_dark
      : settings.body_bg_gradient_direction_light;
    const mid = isDark
      ? settings.body_bg_gradient_midpoint_dark
      : settings.body_bg_gradient_midpoint_light;

    if (!from) {
      document.body.style.background = "";
      document.body.style.backgroundColor = "";
    } else if (to) {
      document.body.style.background = `linear-gradient(${dir ?? "to bottom"}, ${from} ${mid ? mid + "%" : ""}, ${to})`;
      document.body.style.backgroundColor = "";
    } else {
      document.body.style.background = "";
      document.body.style.backgroundColor = from;
    }

    if (settings.primary_color) {
      document.documentElement.style.setProperty("--color-primary", settings.primary_color);
    } else {
      document.documentElement.style.removeProperty("--color-primary");
    }

    const surfaceColor = isDark ? settings.surface_color_dark : settings.surface_color_light;
    if (surfaceColor) {
      document.documentElement.style.setProperty("--color-surface", surfaceColor);
    } else {
      document.documentElement.style.removeProperty("--color-surface");
    }

    const textColor = isDark ? settings.text_color_dark : settings.text_color_light;
    if (textColor) {
      document.documentElement.style.setProperty("--color-text", textColor);
    } else {
      document.documentElement.style.removeProperty("--color-text");
    }

    return () => {
      document.body.style.background = "";
      document.body.style.backgroundColor = "";
      document.documentElement.style.removeProperty("--color-primary");
      document.documentElement.style.removeProperty("--color-surface");
      document.documentElement.style.removeProperty("--color-text");
    };
  }, [isDark, settings]);

  // Tab state — switch to Federation tab if subscribe action is present
  const tabParam = searchParams.get("tab");
  const hasSubscribeAction = searchParams.get("action") === "subscribe";
  const [activeTab, setActiveTab] = useState<AdminTab>(
    hasSubscribeAction
      ? "federation"
      : tabParam === "content" || tabParam === "theme" || tabParam === "federation"
        ? tabParam
        : "general",
  );

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    if (tab === "general") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    // Don't preserve subscribe action params when changing tabs
    if (tab !== "federation") {
      params.delete("action");
      params.delete("remoteUrl");
      params.delete("remoteCatId");
      params.delete("remoteCatName");
      params.delete("remoteCatSlug");
    }
    setSearchParams(params, { replace: true });
  };

  // Detect subscribe action query parameters
  const subscribeAction =
    searchParams.get("action") === "subscribe"
      ? {
          remoteUrl: searchParams.get("remoteUrl") ?? "",
          remoteCatId: searchParams.get("remoteCatId") ?? "",
          remoteCatName: searchParams.get("remoteCatName") ?? "",
          remoteCatSlug: searchParams.get("remoteCatSlug") ?? "",
        }
      : null;

  useEffect(() => {
    if (!isAuthenticated) {
      // Redirect to current URL (including query params) after login
      const currentPath = window.location.pathname + window.location.search;
      void navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }
    void api.get<Record<string, string>>("/settings").then(setSettings);
  }, [isAuthenticated, navigate]);

  const update = (k: string, v: string) => {
    setSettings((p) => ({ ...p, [k]: v }));
  };
  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await api.put("/settings", settings);
      await refreshSiteSettings();
      setMessage(useI18n.getState().t("admin_saved"));
    } catch {
      setMessage(useI18n.getState().t("admin_save_failed"));
    } finally {
      setIsSaving(false);
    }
  };

  const { t, setLocale, locale } = useI18n();
  const desc = settings.seo_description ?? "";
  const title = settings.blog_title ?? "";

  const handleLanguageChange = (lang: string) => {
    update("default_language", lang);
    setLocale(lang as "en" | "ko");
  };

  const handleTestSlack = async () => {
    setTestingSlack(true);
    setSlackTestResult(null);
    try {
      await api.post("/settings/test-slack", {});
      setSlackTestResult("ok");
    } catch {
      setSlackTestResult("error");
    } finally {
      setTestingSlack(false);
    }
  };

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode; emoji: string }[] = [
    {
      key: "general",
      label: t("admin_tab_general"),
      icon: <Settings className="h-4 w-4" />,
      emoji: "⚙️",
    },
    {
      key: "content",
      label: t("admin_tab_content"),
      icon: <FileText className="h-4 w-4" />,
      emoji: "📝",
    },
    {
      key: "theme",
      label: t("admin_tab_theme"),
      icon: <Palette className="h-4 w-4" />,
      emoji: "🎨",
    },
    {
      key: "federation",
      label: t("admin_tab_federation"),
      icon: <Globe className="h-4 w-4" />,
      emoji: "🌐",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SEOHead title={t("admin_title")} />
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--color-text)]">
          <Settings className="h-6 w-6" />
          {t("admin_title")}
        </h1>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-1 h-4 w-4" />
          {isSaving ? t("admin_saving") : t("admin_save")}
        </Button>
      </div>
      {message && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20">
          {message}
        </div>
      )}

      {/* Mobile-only Visitor Stats */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm lg:hidden">
        <VisitorStats />
      </div>

      {/* Tab navigation — select on mobile, buttons on desktop */}
      <div className="relative sm:hidden">
        <select
          value={activeTab}
          onChange={(e) => {
            handleTabChange(e.target.value as AdminTab);
          }}
          className="w-full appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 pr-8 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
        >
          {tabs.map((tab) => (
            <option key={tab.key} value={tab.key}>
              {tab.emoji} {tab.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[var(--color-text-secondary)]">
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>
      <div className="hidden gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 sm:flex">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              handleTabChange(tab.key);
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-text)]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* General settings tab */}
      {activeTab === "general" && (
        <>
          {/* Language settings */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
                <Languages className="h-5 w-5" />
                {t("admin_lang_title")}
              </h2>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                  {t("admin_lang_label")}
                </label>
                <select
                  value={settings.default_language ?? locale}
                  onChange={(e) => {
                    handleLanguageChange(e.target.value);
                  }}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                >
                  <option value="en">English</option>
                  <option value="ko">한국어</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Display settings */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
                <FileText className="h-5 w-5" />
                {t("admin_display_title")}
              </h2>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-[var(--color-text)]">
                      {t("admin_display_lazy_load")}
                    </label>
                  </div>
                  <button
                    role="switch"
                    aria-checked={settings.lazy_load_images === "true"}
                    onClick={() => {
                      update(
                        "lazy_load_images",
                        settings.lazy_load_images === "true" ? "false" : "true",
                      );
                    }}
                    className={`relative h-6 w-11 rounded-full transition-colors ${settings.lazy_load_images === "true" ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${settings.lazy_load_images === "true" ? "left-[22px]" : "left-0.5"}`}
                    />
                  </button>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    {t("admin_display_per_page")}
                  </label>
                  <select
                    value={settings.posts_per_page ?? "10"}
                    onChange={(e) => {
                      update("posts_per_page", e.target.value);
                    }}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                  >
                    {[3, 5, 10, 15, 20, 30].map((n) => (
                      <option key={n} value={String(n)}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    {t("admin_comment_per_page")}
                  </label>
                  <select
                    value={settings.comments_per_page ?? "50"}
                    onChange={(e) => {
                      update("comments_per_page", e.target.value);
                    }}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                  >
                    {[10, 20, 50, 100].map((n) => (
                      <option key={n} value={String(n)}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    {t("admin_comment_mode")}
                  </label>
                  <select
                    value={settings.comment_mode ?? "sso_only"}
                    onChange={(e) => {
                      update("comment_mode", e.target.value);
                    }}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                  >
                    <option value="sso_only">{t("admin_comment_mode_sso")}</option>
                    <option value="all">{t("admin_comment_mode_all")}</option>
                    <option value="anonymous_only">{t("admin_comment_mode_anon")}</option>
                    <option value="disabled">{t("admin_comment_mode_disabled")}</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
                <Activity className="h-5 w-5" />
                {t("admin_notifications")}
              </h2>
              <div className="flex flex-col gap-2">
                <label className="text-sm text-[var(--color-text-secondary)]">
                  {t("admin_slack_webhook_label")}
                </label>
                <div className="flex gap-2">
                  <Input
                    value={settings.notification_slack_webhook ?? ""}
                    onChange={(e) => {
                      update("notification_slack_webhook", e.target.value);
                    }}
                    placeholder="https://hooks.slack.com/services/..."
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void handleTestSlack();
                    }}
                    disabled={testingSlack || !settings.notification_slack_webhook}
                  >
                    {testingSlack ? t("loading") : t("admin_slack_test")}
                  </Button>
                </div>
                {slackTestResult === "ok" && (
                  <p className="text-sm text-green-600">{t("admin_slack_test_ok")}</p>
                )}
                {slackTestResult === "error" && (
                  <p className="text-sm text-red-500">{t("admin_slack_test_error")}</p>
                )}
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t("admin_slack_webhook_hint")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* SEO settings */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
                <Globe className="h-5 w-5" />
                {t("admin_seo_title")}
              </h2>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    {t("admin_seo_canonical_url")}
                  </label>
                  <Input
                    value={settings.canonical_url ?? ""}
                    onChange={(e) => {
                      update("canonical_url", e.target.value);
                    }}
                    placeholder="https://example.com"
                  />
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {t("admin_seo_canonical_url_help")}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    {t("admin_seo_meta_desc")}
                  </label>
                  <Textarea
                    value={desc}
                    onChange={(e) => {
                      update("seo_description", e.target.value);
                    }}
                    maxLength={160}
                    rows={3}
                  />
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {desc.length}/160
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] p-4">
                  <p className="mb-1 text-xs text-[var(--color-text-secondary)]">
                    {t("admin_seo_preview")}
                  </p>
                  <p className="text-lg text-blue-700">{title || t("admin_seo_preview_title")}</p>
                  <p className="text-sm text-green-700">
                    {settings.canonical_url ?? window.location.origin}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {desc || t("admin_seo_preview_desc")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Theme tab */}
      {activeTab === "theme" && <ThemeCustomizer settings={settings} update={update} />}

      {/* Content tab */}
      {activeTab === "content" && (
        <>
          <CategoryManager />
          <PostManager />
        </>
      )}

      {/* Federation tab */}
      {activeTab === "federation" && (
        <>
          {/* Federation settings */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
                <Globe className="h-5 w-5" />
                {t("admin_fed_title")}
              </h2>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    {t("admin_fed_site_url")}
                  </label>
                  <Input value={window.location.origin} disabled className="opacity-60" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    {t("admin_fed_sync_interval")}
                  </label>
                  <select
                    value={settings.webhook_sync_interval ?? "15"}
                    onChange={(e) => {
                      update("webhook_sync_interval", e.target.value);
                    }}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                  >
                    <option value="5">{t("admin_fed_5min")}</option>
                    <option value="15">{t("admin_fed_15min")}</option>
                    <option value="30">{t("admin_fed_30min")}</option>
                    <option value="60">{t("admin_fed_1hour")}</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Categories I'm subscribed to */}
          <SubscriptionManager subscribeAction={subscribeAction} />

          {/* Subscriber management */}
          <SubscriberManager />
        </>
      )}
    </div>
  );
}
