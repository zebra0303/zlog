import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Settings, FileText, Globe, Save, Folder, Plus, Pencil, Trash2, Check, X, Palette, Upload, Loader2, Rss, Languages } from "lucide-react";
import { Button, Input, Textarea, Card, CardContent, SEOHead, Badge } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useAuthStore } from "@/features/auth/model/store";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";
import { useI18n } from "@/shared/i18n";
import type { CategoryWithStats } from "@zlog/shared";

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

  const fetchCategories = () => {
    void api.get<CategoryWithStats[]>("/categories").then(setCategories).catch(() => {});
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) { setError(t("admin_cat_name_required")); return; }
    setError(null);
    try {
      await api.post("/categories", { name: newName, description: newDesc || undefined, isPublic: newIsPublic });
      setNewName(""); setNewDesc(""); setNewIsPublic(true); setIsAdding(false);
      fetchCategories();
    } catch (err) { setError(err instanceof Error ? err.message : t("admin_cat_create_failed")); }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) { setError(t("admin_cat_name_required")); return; }
    setError(null);
    try {
      await api.put(`/categories/${id}`, { name: editName, description: editDesc || undefined, isPublic: editIsPublic });
      setEditingId(null);
      fetchCategories();
    } catch (err) { setError(err instanceof Error ? err.message : t("admin_cat_update_failed")); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t("admin_cat_delete_confirm", { name }))) return;
    try {
      await api.delete(`/categories/${id}`);
      fetchCategories();
    } catch (err) { setError(err instanceof Error ? err.message : t("admin_cat_delete_failed")); }
  };

  const startEdit = (cat: CategoryWithStats) => {
    setEditingId(cat.id); setEditName(cat.name); setEditDesc(cat.description ?? ""); setEditIsPublic(cat.isPublic);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]"><Folder className="h-5 w-5" />{t("admin_cat_title")}</h2>
          {!isAdding && (
            <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}><Plus className="mr-1 h-4 w-4" />{t("admin_cat_add")}</Button>
          )}
        </div>

        {error && <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20">{error}</div>}

        {isAdding && (
          <div className="mb-4 rounded-lg border border-[var(--color-primary)] bg-[var(--color-background)] p-4">
            <h3 className="mb-3 text-sm font-medium text-[var(--color-text)]">{t("admin_cat_new")}</h3>
            <div className="flex flex-col gap-3">
              <Input placeholder={t("admin_cat_name_placeholder")} value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
              <Input placeholder={t("admin_cat_desc_placeholder")} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--color-text)]">{t("public")}</label>
                <button
                  onClick={() => setNewIsPublic(!newIsPublic)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${newIsPublic ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${newIsPublic ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setIsAdding(false); setNewName(""); setNewDesc(""); setError(null); }}>{t("cancel")}</Button>
                <Button size="sm" onClick={handleCreate}>{t("create")}</Button>
              </div>
            </div>
          </div>
        )}

        {categories.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">{t("admin_cat_empty")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {categories.map((cat) => (
              <div key={cat.id} className="rounded-lg border border-[var(--color-border)] p-3">
                {editingId === cat.id ? (
                  <div className="flex flex-col gap-3">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                    <Input placeholder={t("admin_cat_desc_placeholder")} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-[var(--color-text)]">{t("public")}</label>
                      <button
                        onClick={() => setEditIsPublic(!editIsPublic)}
                        className={`relative h-6 w-11 rounded-full transition-colors ${editIsPublic ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${editIsPublic ? "left-[22px]" : "left-0.5"}`} />
                      </button>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setError(null); }}><X className="mr-1 h-3 w-3" />{t("cancel")}</Button>
                      <Button size="sm" onClick={() => handleUpdate(cat.id)}><Check className="mr-1 h-3 w-3" />{t("save")}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--color-text)]">{cat.name}</span>
                        <Badge variant="secondary">{cat.postCount} {t("admin_cat_posts_count")}</Badge>
                        {!cat.isPublic && <Badge variant="outline">{t("private")}</Badge>}
                      </div>
                      {cat.description && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{cat.description}</p>}
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">/{cat.slug}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(cat)} aria-label={t("edit")}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id, cat.name)} aria-label={t("delete")}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
  settingKey,
  value,
  onChange,
  placeholder,
}: {
  settingKey: string;
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
      <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t("admin_theme_bg_image")}</label>
      <div className="flex items-center gap-2">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-xs"
        />
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-background)]">
          <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {uploading ? t("uploading") : t("upload")}
        </label>
        {value && (
          <button onClick={() => onChange("")} className="text-xs text-red-500 hover:underline">{t("reset")}</button>
        )}
      </div>
    </div>
  );
}

// ============ Theme Customizer ============
function ThemeCustomizer({ settings, update }: { settings: Record<string, string>; update: (k: string, v: string) => void }) {
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
          <Palette className="h-5 w-5" />{t("admin_theme_title")}
        </h2>
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          {t("admin_theme_desc")}
        </p>

        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <div key={section.title} className="rounded-lg border border-[var(--color-border)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium text-[var(--color-text)]">{section.title}</h3>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[var(--color-text-secondary)]">{t("admin_theme_height")}</label>
                  <select
                    value={settings[section.heightKey] ?? "auto"}
                    onChange={(e) => update(section.heightKey, e.target.value)}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text)]"
                  >
                    {heightOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Light Mode */}
                <div className="rounded-lg bg-[var(--color-background)] p-3">
                  <h4 className="mb-2 text-sm font-medium text-[var(--color-text)]">{t("admin_theme_light_mode")}</h4>
                  <div className="flex flex-col gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t("admin_theme_bg_color")}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings[section.keys.lightColor] || "#ffffff"}
                          onChange={(e) => update(section.keys.lightColor, e.target.value)}
                          className="h-8 w-8 cursor-pointer rounded border border-[var(--color-border)]"
                        />
                        <Input
                          placeholder="#ffffff"
                          value={settings[section.keys.lightColor] ?? ""}
                          onChange={(e) => update(section.keys.lightColor, e.target.value)}
                          className="flex-1 text-xs"
                        />
                        {settings[section.keys.lightColor] && (
                          <button onClick={() => update(section.keys.lightColor, "")} className="text-xs text-red-500 hover:underline">
                            {t("reset")}
                          </button>
                        )}
                      </div>
                    </div>
                    <ImageUploadInput
                      settingKey={section.keys.lightImage}
                      value={settings[section.keys.lightImage] ?? ""}
                      onChange={(url) => update(section.keys.lightImage, url)}
                      placeholder={t("admin_theme_image_placeholder")}
                    />
                    {(settings[section.keys.lightColor] || settings[section.keys.lightImage]) && (
                      <div
                        className="mt-1 h-12 rounded border border-[var(--color-border)]"
                        style={{
                          backgroundColor: settings[section.keys.lightColor] || undefined,
                          backgroundImage: settings[section.keys.lightImage] ? `url(${settings[section.keys.lightImage]})` : undefined,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                    )}
                  </div>
                </div>
                {/* Dark Mode */}
                <div className="rounded-lg bg-[var(--color-background)] p-3">
                  <h4 className="mb-2 text-sm font-medium text-[var(--color-text)]">{t("admin_theme_dark_mode")}</h4>
                  <div className="flex flex-col gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t("admin_theme_bg_color")}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings[section.keys.darkColor] || "#1a1a24"}
                          onChange={(e) => update(section.keys.darkColor, e.target.value)}
                          className="h-8 w-8 cursor-pointer rounded border border-[var(--color-border)]"
                        />
                        <Input
                          placeholder="#1a1a24"
                          value={settings[section.keys.darkColor] ?? ""}
                          onChange={(e) => update(section.keys.darkColor, e.target.value)}
                          className="flex-1 text-xs"
                        />
                        {settings[section.keys.darkColor] && (
                          <button onClick={() => update(section.keys.darkColor, "")} className="text-xs text-red-500 hover:underline">
                            {t("reset")}
                          </button>
                        )}
                      </div>
                    </div>
                    <ImageUploadInput
                      settingKey={section.keys.darkImage}
                      value={settings[section.keys.darkImage] ?? ""}
                      onChange={(url) => update(section.keys.darkImage, url)}
                      placeholder={t("admin_theme_image_placeholder")}
                    />
                    {/* 미리보기 */}
                    {(settings[section.keys.darkColor] || settings[section.keys.darkImage]) && (
                      <div
                        className="mt-1 h-12 rounded border border-[var(--color-border)]"
                        style={{
                          backgroundColor: settings[section.keys.darkColor] || undefined,
                          backgroundImage: settings[section.keys.darkImage] ? `url(${settings[section.keys.darkImage]})` : undefined,
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
      .catch(() => setIsLoading(false));
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
          <Rss className="h-5 w-5" />{t("admin_sub_title")}
        </h2>
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          {t("admin_sub_desc")}
        </p>

        {isLoading ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">{t("admin_sub_loading")}</p>
        ) : subscribers.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">{t("admin_sub_empty")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {subscribers.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">{sub.subscriberUrl}</span>
                    <Badge variant="secondary">{sub.categoryName ?? t("admin_sub_deleted_cat")}</Badge>
                    {!sub.isActive && <Badge variant="outline">{t("admin_sub_inactive")}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                    {t("admin_sub_callback")} {sub.callbackUrl}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("admin_sub_date")} {new Date(sub.createdAt).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US")}
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
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { void navigate("/login"); return; }
    void api.get<Record<string, string>>("/settings").then(setSettings);
  }, [isAuthenticated, navigate]);

  const update = (k: string, v: string) => setSettings((p) => ({ ...p, [k]: v }));
  const handleSave = async () => {
    setIsSaving(true); setMessage(null);
    try {
      await api.put("/settings", settings);
      await refreshSiteSettings();
      setMessage(useI18n.getState().t("admin_saved"));
    }
    catch { setMessage(useI18n.getState().t("admin_save_failed")); }
    finally { setIsSaving(false); }
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
          <Settings className="h-6 w-6" />{t("admin_title")}
        </h1>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-1 h-4 w-4" />{isSaving ? t("admin_saving") : t("admin_save")}
        </Button>
      </div>
      {message && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20">{message}</div>}

      {/* 언어 설정 */}
      <Card><CardContent className="pt-6"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]"><Languages className="h-5 w-5" />{t("admin_lang_title")}</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("admin_lang_label")}</label>
          <select value={settings.default_language ?? locale} onChange={(e) => handleLanguageChange(e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]">
            <option value="en">English</option>
            <option value="ko">한국어</option>
          </select>
        </div>
      </CardContent></Card>

      {/* 카테고리 관리 */}
      <CategoryManager />

      {/* 표시 설정 */}
      <Card><CardContent className="pt-6"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]"><FileText className="h-5 w-5" />{t("admin_display_title")}</h2>
        <div className="flex flex-col gap-4">
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("admin_display_per_page")}</label><select value={settings.posts_per_page ?? "10"} onChange={(e) => update("posts_per_page", e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]">{[3,5,10,15,20,30].map((n) => <option key={n} value={String(n)}>{n}</option>)}</select></div>
          <div className="flex items-center justify-between"><div><label className="text-sm font-medium text-[var(--color-text)]">{t("admin_display_lazy_load")}</label></div><button onClick={() => update("lazy_load_images", settings.lazy_load_images === "true" ? "false" : "true")} className={`relative h-6 w-11 rounded-full transition-colors ${settings.lazy_load_images === "true" ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${settings.lazy_load_images === "true" ? "left-[22px]" : "left-0.5"}`} /></button></div>
        </div>
      </CardContent></Card>

      {/* SEO 설정 */}
      <Card><CardContent className="pt-6"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]"><Globe className="h-5 w-5" />{t("admin_seo_title")}</h2>
        <div className="flex flex-col gap-4">
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("admin_seo_blog_title")}</label><Input value={title} onChange={(e) => update("blog_title", e.target.value)} /></div>
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("admin_seo_meta_desc")}</label><Textarea value={desc} onChange={(e) => update("seo_description", e.target.value)} maxLength={160} rows={3} /><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{desc.length}/160</p></div>
          <div className="rounded-lg border border-[var(--color-border)] p-4"><p className="mb-1 text-xs text-[var(--color-text-secondary)]">{t("admin_seo_preview")}</p><p className="text-lg text-blue-700">{title || t("admin_seo_preview_title")}</p><p className="text-sm text-green-700">{window.location.origin}</p><p className="text-sm text-[var(--color-text-secondary)]">{desc || t("admin_seo_preview_desc")}</p></div>
        </div>
      </CardContent></Card>

      {/* 헤더/푸터 테마 커스터마이징 */}
      <ThemeCustomizer settings={settings} update={update} />

      {/* Federation 설정 */}
      <Card><CardContent className="pt-6"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]"><Globe className="h-5 w-5" />{t("admin_fed_title")}</h2>
        <div className="flex flex-col gap-4">
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("admin_fed_site_url")}</label><Input value={window.location.origin} disabled className="opacity-60" /></div>
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("admin_fed_sync_interval")}</label><select value={settings.webhook_sync_interval ?? "15"} onChange={(e) => update("webhook_sync_interval", e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"><option value="5">{t("admin_fed_5min")}</option><option value="15">{t("admin_fed_15min")}</option><option value="30">{t("admin_fed_30min")}</option><option value="60">{t("admin_fed_1hour")}</option></select></div>
        </div>
      </CardContent></Card>

      {/* 구독자 관리 */}
      <SubscriberManager />
    </div>
  );
}
