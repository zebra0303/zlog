import { useCallback, useEffect, useRef, useState } from "react";
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
} from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useAuthStore } from "@/features/auth/model/store";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";
import { useI18n } from "@/shared/i18n";
import { timeAgo } from "@/shared/lib/formatDate";
import type { CategoryWithStats, PostWithCategory, PaginatedResponse } from "@zlog/shared";

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
  const { t } = useI18n();

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

        {/* 검색 */}
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
                <div
                  key={post.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3"
                >
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
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
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
          <div className="mb-4 rounded-lg border border-[var(--color-primary)] bg-[var(--color-background)] p-4">
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
                          {cat.postCount} {t("admin_cat_posts_count")}
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
                        onClick={() => handleDelete(cat.id, cat.name)}
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

  const sections = [
    {
      title: t("admin_theme_header"),
      heightKey: "header_height",
      keys: {
        lightColor: "header_bg_color_light",
        darkColor: "header_bg_color_dark",
        lightImage: "header_bg_image_light",
        darkImage: "header_bg_image_dark",
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
      },
    },
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
          <Palette className="h-5 w-5" />
          {t("admin_theme_title")}
        </h2>
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">{t("admin_theme_desc")}</p>

        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <div key={section.title} className="rounded-lg border border-[var(--color-border)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium text-[var(--color-text)]">{section.title}</h3>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[var(--color-text-secondary)]">
                    {t("admin_theme_height")}
                  </label>
                  <select
                    value={settings[section.heightKey] ?? "auto"}
                    onChange={(e) => {
                      update(section.heightKey, e.target.value);
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
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Light Mode */}
                <div className="rounded-lg bg-[var(--color-background)] p-3">
                  <h4 className="mb-2 text-sm font-medium text-[var(--color-text)]">
                    {t("admin_theme_light_mode")}
                  </h4>
                  <div className="flex flex-col gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                        {t("admin_theme_bg_color")}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings[section.keys.lightColor] ?? "#ffffff"}
                          onChange={(e) => {
                            update(section.keys.lightColor, e.target.value);
                          }}
                          className="h-8 w-8 cursor-pointer rounded border border-[var(--color-border)]"
                        />
                        <Input
                          placeholder="#ffffff"
                          value={settings[section.keys.lightColor] ?? ""}
                          onChange={(e) => {
                            update(section.keys.lightColor, e.target.value);
                          }}
                          className="flex-1 text-xs"
                        />
                        {settings[section.keys.lightColor] && (
                          <button
                            onClick={() => {
                              update(section.keys.lightColor, "");
                            }}
                            className="text-xs text-red-500 hover:underline"
                          >
                            {t("reset")}
                          </button>
                        )}
                      </div>
                    </div>
                    <ImageUploadInput
                      value={settings[section.keys.lightImage] ?? ""}
                      onChange={(url) => {
                        update(section.keys.lightImage, url);
                      }}
                      placeholder={t("admin_theme_image_placeholder")}
                    />
                    {[settings[section.keys.lightColor], settings[section.keys.lightImage]].some(
                      Boolean,
                    ) && (
                      <div
                        className="mt-1 h-12 rounded border border-[var(--color-border)]"
                        style={{
                          backgroundColor: settings[section.keys.lightColor] ?? undefined,
                          backgroundImage: settings[section.keys.lightImage]
                            ? `url(${settings[section.keys.lightImage]})`
                            : undefined,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
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
                        {t("admin_theme_bg_color")}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings[section.keys.darkColor] ?? "#1a1a24"}
                          onChange={(e) => {
                            update(section.keys.darkColor, e.target.value);
                          }}
                          className="h-8 w-8 cursor-pointer rounded border border-[var(--color-border)]"
                        />
                        <Input
                          placeholder="#1a1a24"
                          value={settings[section.keys.darkColor] ?? ""}
                          onChange={(e) => {
                            update(section.keys.darkColor, e.target.value);
                          }}
                          className="flex-1 text-xs"
                        />
                        {settings[section.keys.darkColor] && (
                          <button
                            onClick={() => {
                              update(section.keys.darkColor, "");
                            }}
                            className="text-xs text-red-500 hover:underline"
                          >
                            {t("reset")}
                          </button>
                        )}
                      </div>
                    </div>
                    <ImageUploadInput
                      value={settings[section.keys.darkImage] ?? ""}
                      onChange={(url) => {
                        update(section.keys.darkImage, url);
                      }}
                      placeholder={t("admin_theme_image_placeholder")}
                    />
                    {/* 미리보기 */}
                    {[settings[section.keys.darkColor], settings[section.keys.darkImage]].some(
                      Boolean,
                    ) && (
                      <div
                        className="mt-1 h-12 rounded border border-[var(--color-border)]"
                        style={{
                          backgroundColor: settings[section.keys.darkColor] ?? undefined,
                          backgroundImage: settings[section.keys.darkImage]
                            ? `url(${settings[section.keys.darkImage]})`
                            : undefined,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ Subscription Manager (내가 구독 중인 카테고리) ============
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

function SubscriptionManager({ subscribeAction }: { subscribeAction?: SubscribeActionParams | null }) {
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

  // 구독 추가 폼 상태
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

  // 로컬 카테고리 목록 (폼 열릴 때)
  useEffect(() => {
    if (showAddForm && localCats.length === 0) {
      void api.get<CategoryWithStats[]>("/categories").then(setLocalCats);
    }
  }, [showAddForm, localCats.length]);

  // subscribeAction 으로 자동 열기
  const actionProcessed = useRef(false);
  useEffect(() => {
    if (!subscribeAction || actionProcessed.current) return;
    actionProcessed.current = true;
    setShowAddForm(true);
    let url = subscribeAction.remoteUrl;
    if (!url.startsWith("http")) url = `https://${url}`;
    url = url.replace(/\/+$/, "");
    setAddUrl(url);
    // 자동으로 카테고리 fetch
    setIsFetchingCats(true);
    setAddMessage(null);
    setRemoteCats([]);
    void api.get<RemoteCategoryOption[]>(
      `/federation/remote-categories?url=${encodeURIComponent(url)}`,
    ).then((cats) => {
      if (cats.length > 0) {
        setRemoteCats(cats);
        // remoteCatId 와 일치하는 카테고리 선택
        const match = cats.find((c) => c.id === subscribeAction.remoteCatId);
        if (match) setSelectedRemoteCat(match.id);
      } else {
        setAddMessage({ text: t("admin_mysub_add_fetch_failed"), type: "error" });
      }
    }).catch(() => {
      setAddMessage({ text: t("admin_mysub_add_fetch_failed"), type: "error" });
    }).finally(() => {
      setIsFetchingCats(false);
      // 구독관리 섹션으로 스크롤 + 로컬 카테고리 포커스
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
    // URL 정규화
    if (!url.startsWith("http")) url = `https://${url}`;
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
    } catch {
      setAddMessage({ text: t("admin_mysub_add_fetch_failed"), type: "error" });
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
    const mySiteUrl = window.location.origin;
    const myCallbackUrl = `${mySiteUrl}/api/federation/webhook`;

    setIsSubscribing(true);
    setAddMessage(null);
    try {
      // 1) 원격 블로그에 구독자 등록 (원격 블로그가 웹훅을 보낼 수 있도록)
      try {
        await fetch(`${remoteSiteUrl}/api/federation/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: remoteCat.id,
            subscriberUrl: mySiteUrl,
            callbackUrl: myCallbackUrl,
          }),
        });
      } catch {
        /* 원격 블로그 등록 실패해도 로컬 구독은 진행 */
      }

      // 2) 로컬 구독 레코드 생성
      await api.post("/federation/local-subscribe", {
        remoteSiteUrl,
        remoteCategoryId: remoteCat.id,
        remoteCategoryName: remoteCat.name,
        remoteCategorySlug: remoteCat.slug,
        localCategorySlug: localCat.slug,
      });
      setAddMessage({ text: t("admin_mysub_add_success"), type: "success" });
      // 리셋
      setAddUrl("");
      setRemoteCats([]);
      setSelectedRemoteCat("");
      setSelectedLocalCat("");
      setShowAddForm(false);
      fetchSubs();
    } catch {
      setAddMessage({ text: t("admin_mysub_add_subscribe_failed"), type: "error" });
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
    } catch {
      setSyncMessage({ id: sub.id, text: t("admin_mysub_sync_failed"), type: "error" });
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

        {/* 구독 추가 폼 */}
        {showAddForm && (
          <div className="mb-4 rounded-lg border border-[var(--color-primary)] bg-[var(--color-surface)] p-4">
            <div className="flex flex-col gap-3">
              {/* Step 1: URL 입력 + 카테고리 불러오기 */}
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

              {/* Step 2: 원격 카테고리 + 로컬 카테고리 선택 */}
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

              {/* Step 3: 구독 버튼 */}
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
                      aria-label={sub.isActive ? t("admin_mysub_deactivate") : t("admin_mysub_activate")}
                      title={sub.isActive ? t("admin_mysub_deactivate") : t("admin_mysub_activate")}
                    >
                      <Power className={`h-4 w-4 ${sub.isActive ? "text-green-500" : "text-[var(--color-text-secondary)]"}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(sub)} aria-label={t("delete")}>
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
                  onClick={() => handleDelete(sub)}
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

// ============ 메인 AdminPage ============
export default function AdminPage() {
  const { isAuthenticated } = useAuthStore();
  const { fetchSettings: refreshSiteSettings } = useSiteSettingsStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // subscribe action 쿼리 파라미터 감지
  const subscribeAction = searchParams.get("action") === "subscribe"
    ? {
        remoteUrl: searchParams.get("remoteUrl") ?? "",
        remoteCatId: searchParams.get("remoteCatId") ?? "",
        remoteCatName: searchParams.get("remoteCatName") ?? "",
        remoteCatSlug: searchParams.get("remoteCatSlug") ?? "",
      }
    : null;

  useEffect(() => {
    if (!isAuthenticated) {
      // 로그인 후 현재 URL(쿼리 파라미터 포함)으로 리디렉트
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

      {/* 언어 설정 */}
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

      {/* 글 관리 */}
      <PostManager />

      {/* 카테고리 관리 */}
      <CategoryManager />

      {/* 표시 설정 */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
            <FileText className="h-5 w-5" />
            {t("admin_display_title")}
          </h2>
          <div className="flex flex-col gap-4">
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
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">
                  {t("admin_display_lazy_load")}
                </label>
              </div>
              <button
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

      {/* SEO 설정 */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
            <Globe className="h-5 w-5" />
            {t("admin_seo_title")}
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                {t("admin_seo_blog_title")}
              </label>
              <Input
                value={title}
                onChange={(e) => {
                  update("blog_title", e.target.value);
                }}
              />
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
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{desc.length}/160</p>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] p-4">
              <p className="mb-1 text-xs text-[var(--color-text-secondary)]">
                {t("admin_seo_preview")}
              </p>
              <p className="text-lg text-blue-700">{title || t("admin_seo_preview_title")}</p>
              <p className="text-sm text-green-700">{window.location.origin}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {desc || t("admin_seo_preview_desc")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 헤더/푸터 테마 커스터마이징 */}
      <ThemeCustomizer settings={settings} update={update} />

      {/* Federation 설정 */}
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

      {/* 내가 구독 중인 카테고리 */}
      <SubscriptionManager subscribeAction={subscribeAction} />

      {/* 구독자 관리 */}
      <SubscriberManager />
    </div>
  );
}
