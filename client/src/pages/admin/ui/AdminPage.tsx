import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Settings, FileText, Globe, Save, Folder, Plus, Pencil, Trash2, Check, X, Palette } from "lucide-react";
import { Button, Input, Textarea, Card, CardContent, SEOHead, Badge } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useAuthStore } from "@/features/auth/model/store";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";
import type { CategoryWithStats } from "@zlog/shared";

// ============ 카테고리 관리 컴포넌트 ============
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

  const fetchCategories = () => {
    void api.get<CategoryWithStats[]>("/categories").then(setCategories).catch(() => {});
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) { setError("카테고리 이름을 입력해주세요."); return; }
    setError(null);
    try {
      await api.post("/categories", { name: newName, description: newDesc || undefined, isPublic: newIsPublic });
      setNewName(""); setNewDesc(""); setNewIsPublic(true); setIsAdding(false);
      fetchCategories();
    } catch (err) { setError(err instanceof Error ? err.message : "생성에 실패했습니다."); }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) { setError("카테고리 이름을 입력해주세요."); return; }
    setError(null);
    try {
      await api.put(`/categories/${id}`, { name: editName, description: editDesc || undefined, isPublic: editIsPublic });
      setEditingId(null);
      fetchCategories();
    } catch (err) { setError(err instanceof Error ? err.message : "수정에 실패했습니다."); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 카테고리를 삭제하시겠습니까?\n이 카테고리에 속한 게시글은 카테고리 없음 상태가 됩니다.`)) return;
    try {
      await api.delete(`/categories/${id}`);
      fetchCategories();
    } catch (err) { setError(err instanceof Error ? err.message : "삭제에 실패했습니다."); }
  };

  const startEdit = (cat: CategoryWithStats) => {
    setEditingId(cat.id); setEditName(cat.name); setEditDesc(cat.description ?? ""); setEditIsPublic(cat.isPublic);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]"><Folder className="h-5 w-5" />카테고리 관리</h2>
          {!isAdding && (
            <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}><Plus className="mr-1 h-4 w-4" />추가</Button>
          )}
        </div>

        {error && <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20">{error}</div>}

        {/* 새 카테고리 생성 폼 */}
        {isAdding && (
          <div className="mb-4 rounded-lg border border-[var(--color-primary)] bg-[var(--color-background)] p-4">
            <h3 className="mb-3 text-sm font-medium text-[var(--color-text)]">새 카테고리</h3>
            <div className="flex flex-col gap-3">
              <Input placeholder="카테고리 이름" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
              <Input placeholder="설명 (선택)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--color-text)]">공개</label>
                <button
                  onClick={() => setNewIsPublic(!newIsPublic)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${newIsPublic ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${newIsPublic ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setIsAdding(false); setNewName(""); setNewDesc(""); setError(null); }}>취소</Button>
                <Button size="sm" onClick={handleCreate}>생성</Button>
              </div>
            </div>
          </div>
        )}

        {/* 카테고리 목록 */}
        {categories.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">카테고리가 없습니다. 위의 추가 버튼으로 생성하세요.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {categories.map((cat) => (
              <div key={cat.id} className="rounded-lg border border-[var(--color-border)] p-3">
                {editingId === cat.id ? (
                  /* 수정 모드 */
                  <div className="flex flex-col gap-3">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                    <Input placeholder="설명" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-[var(--color-text)]">공개</label>
                      <button
                        onClick={() => setEditIsPublic(!editIsPublic)}
                        className={`relative h-6 w-11 rounded-full transition-colors ${editIsPublic ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${editIsPublic ? "left-[22px]" : "left-0.5"}`} />
                      </button>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setError(null); }}><X className="mr-1 h-3 w-3" />취소</Button>
                      <Button size="sm" onClick={() => handleUpdate(cat.id)}><Check className="mr-1 h-3 w-3" />저장</Button>
                    </div>
                  </div>
                ) : (
                  /* 보기 모드 */
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--color-text)]">{cat.name}</span>
                        <Badge variant="secondary">{cat.postCount}개</Badge>
                        {!cat.isPublic && <Badge variant="outline">비공개</Badge>}
                      </div>
                      {cat.description && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{cat.description}</p>}
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">/{cat.slug}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(cat)} aria-label="수정"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id, cat.name)} aria-label="삭제"><Trash2 className="h-4 w-4 text-red-500" /></Button>
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

// ============ 색상 미리보기 컴포넌트 ============
function ColorPreview({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-8 w-8 rounded border border-[var(--color-border)]"
        style={{ backgroundColor: color || "transparent" }}
      />
      <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
    </div>
  );
}

// ============ 헤더/푸터 테마 섹션 ============
function ThemeCustomizer({ settings, update }: { settings: Record<string, string>; update: (k: string, v: string) => void }) {
  const sections = [
    {
      title: "헤더 (Header)",
      keys: {
        lightColor: "header_bg_color_light",
        darkColor: "header_bg_color_dark",
        lightImage: "header_bg_image_light",
        darkImage: "header_bg_image_dark",
      },
    },
    {
      title: "푸터 (Footer)",
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
          <Palette className="h-5 w-5" />헤더/푸터 테마 커스터마이징
        </h2>
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          밝은 모드와 어두운 모드에서 각각 다른 배경색이나 배경 이미지를 설정할 수 있습니다. 비워두면 기본 테마 색상이 사용됩니다.
        </p>

        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <div key={section.title} className="rounded-lg border border-[var(--color-border)] p-4">
              <h3 className="mb-3 font-medium text-[var(--color-text)]">{section.title}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* 밝은 모드 */}
                <div className="rounded-lg bg-[var(--color-background)] p-3">
                  <h4 className="mb-2 text-sm font-medium text-[var(--color-text)]">밝은 모드</h4>
                  <div className="flex flex-col gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">배경색</label>
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
                          <button
                            onClick={() => update(section.keys.lightColor, "")}
                            className="text-xs text-red-500 hover:underline"
                          >
                            초기화
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">배경 이미지 URL</label>
                      <Input
                        placeholder="https://example.com/header-light.jpg"
                        value={settings[section.keys.lightImage] ?? ""}
                        onChange={(e) => update(section.keys.lightImage, e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    {/* 미리보기 */}
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
                {/* 어두운 모드 */}
                <div className="rounded-lg bg-[var(--color-background)] p-3">
                  <h4 className="mb-2 text-sm font-medium text-[var(--color-text)]">어두운 모드</h4>
                  <div className="flex flex-col gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">배경색</label>
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
                          <button
                            onClick={() => update(section.keys.darkColor, "")}
                            className="text-xs text-red-500 hover:underline"
                          >
                            초기화
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">배경 이미지 URL</label>
                      <Input
                        placeholder="https://example.com/header-dark.jpg"
                        value={settings[section.keys.darkImage] ?? ""}
                        onChange={(e) => update(section.keys.darkImage, e.target.value)}
                        className="text-xs"
                      />
                    </div>
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
      setMessage("설정이 저장되었습니다.");
    }
    catch { setMessage("저장에 실패했습니다."); }
    finally { setIsSaving(false); }
  };

  const desc = settings.seo_description ?? "";
  const title = settings.blog_title ?? "";

  return (
    <div className="flex flex-col gap-6">
      <SEOHead title="관리자 설정" />
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--color-text)]">
          <Settings className="h-6 w-6" />관리자 설정
        </h1>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-1 h-4 w-4" />{isSaving ? "저장 중..." : "설정 저장"}
        </Button>
      </div>
      {message && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20">{message}</div>}

      {/* 카테고리 관리 */}
      <CategoryManager />

      {/* 표시 설정 */}
      <Card><CardContent className="pt-6"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]"><FileText className="h-5 w-5" />표시 설정</h2>
        <div className="flex flex-col gap-4">
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">페이지당 게시글 수</label><select value={settings.posts_per_page ?? "10"} onChange={(e) => update("posts_per_page", e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]">{[3,5,10,15,20,30].map((n) => <option key={n} value={String(n)}>{n}개</option>)}</select></div>
          <div className="flex items-center justify-between"><div><label className="text-sm font-medium text-[var(--color-text)]">이미지 Lazy Loading</label></div><button onClick={() => update("lazy_load_images", settings.lazy_load_images === "true" ? "false" : "true")} className={`relative h-6 w-11 rounded-full transition-colors ${settings.lazy_load_images === "true" ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${settings.lazy_load_images === "true" ? "left-[22px]" : "left-0.5"}`} /></button></div>
        </div>
      </CardContent></Card>

      {/* SEO 설정 */}
      <Card><CardContent className="pt-6"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]"><Globe className="h-5 w-5" />SEO 설정</h2>
        <div className="flex flex-col gap-4">
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">블로그 제목</label><Input value={title} onChange={(e) => update("blog_title", e.target.value)} /></div>
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">메타 설명</label><Textarea value={desc} onChange={(e) => update("seo_description", e.target.value)} maxLength={160} rows={3} /><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{desc.length}/160자</p></div>
          <div className="rounded-lg border border-[var(--color-border)] p-4"><p className="mb-1 text-xs text-[var(--color-text-secondary)]">Google 검색 미리보기</p><p className="text-lg text-blue-700">{title || "블로그 제목"}</p><p className="text-sm text-green-700">{window.location.origin}</p><p className="text-sm text-[var(--color-text-secondary)]">{desc || "블로그 설명이 여기에 표시됩니다."}</p></div>
        </div>
      </CardContent></Card>

      {/* 헤더/푸터 테마 커스터마이징 */}
      <ThemeCustomizer settings={settings} update={update} />

      {/* Federation 설정 */}
      <Card><CardContent className="pt-6"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]"><Globe className="h-5 w-5" />Federation 설정</h2>
        <div className="flex flex-col gap-4">
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">사이트 URL</label><Input value={window.location.origin} disabled className="opacity-60" /></div>
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Webhook 동기화 주기</label><select value={settings.webhook_sync_interval ?? "15"} onChange={(e) => update("webhook_sync_interval", e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"><option value="5">5분</option><option value="15">15분</option><option value="30">30분</option><option value="60">1시간</option></select></div>
        </div>
      </CardContent></Card>
    </div>
  );
}
