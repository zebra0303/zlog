import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { Eye, Edit3, Columns, Save, ArrowLeft, ImageIcon } from "lucide-react";
import { Button, Input, Card, CardContent, SEOHead } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { parseMarkdown } from "@/shared/lib/markdown/parser";
import { useAuthStore } from "@/features/auth/model/store";
import type { PostWithCategory, CategoryWithStats, CreatePostRequest } from "@zlog/shared";

type ViewMode = "edit" | "split" | "preview";

export default function PostEditorPage() {
  const { id } = useParams<{ id: string }>(); const navigate = useNavigate(); const { isAuthenticated } = useAuthStore();
  const [title, setTitle] = useState(""); const [content, setContent] = useState(""); const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState(""); const [status, setStatus] = useState<"draft" | "published">("draft"); const [coverImage, setCoverImage] = useState("");
  const [preview, setPreview] = useState(""); const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [categories, setCategories] = useState<CategoryWithStats[]>([]); const [isSaving, setIsSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (!isAuthenticated) void navigate("/login"); }, [isAuthenticated, navigate]);
  useEffect(() => { void api.get<CategoryWithStats[]>("/categories").then(setCategories); }, []);
  useEffect(() => { if (!id) return; void api.get<PostWithCategory>(`/posts/${id}`).then((p) => { setTitle(p.title); setContent(p.content); setCategoryId(p.categoryId ?? ""); setStatus(p.status as "draft"|"published"); setCoverImage(p.coverImage ?? ""); setTags(p.tags.map((t) => t.name).join(", ")); }); }, [id]);
  useEffect(() => { const t = setTimeout(() => { void parseMarkdown(content).then(setPreview); }, 150); return () => clearTimeout(t); }, [content]);

  // 이미지 업로드 후 마크다운에 삽입
  const uploadAndInsertImage = useCallback(async (file: File) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    setIsUploading(true);

    // 커서 위치에 placeholder 삽입
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const placeholder = `![이미지 업로드 중...](uploading)\n`;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const withPlaceholder = before + placeholder + after;
    setContent(withPlaceholder);

    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await api.upload<{ url: string }>("/upload/image", fd);
      const markdown = `![${file.name}](${res.url})\n`;
      // placeholder를 실제 마크다운으로 교체
      setContent((prev) => prev.replace(placeholder, markdown));
    } catch {
      // 실패 시 placeholder 제거
      setContent((prev) => prev.replace(placeholder, ""));
      setError("이미지 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  }, [content]);

  // 붙여넣기 핸들러
  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await uploadAndInsertImage(file);
        return;
      }
    }
  }, [uploadAndInsertImage]);

  // 드래그앤드롭 핸들러
  const handleDrop = useCallback(async (e: React.DragEvent<HTMLTextAreaElement>) => {
    const files = e.dataTransfer.files;
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        e.preventDefault();
        await uploadAndInsertImage(file);
        return;
      }
    }
  }, [uploadAndInsertImage]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    if ([...e.dataTransfer.items].some((i) => i.type.startsWith("image/"))) {
      e.preventDefault();
    }
  }, []);

  const handleSave = async (s: "draft" | "published") => {
    if (!title.trim() || !content.trim()) { setError("제목과 내용을 입력해주세요."); return; }
    if (s === "published" && !categoryId) { setError("발행하려면 카테고리를 선택해주세요."); return; }
    setIsSaving(true); setError(null);
    try {
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      const payload: CreatePostRequest = { title, content, categoryId: categoryId || undefined, status: s, tags: tagList.length > 0 ? tagList : undefined, coverImage: coverImage || undefined };
      if (id) await api.put(`/posts/${id}`, payload); else await api.post("/posts", payload);
      void navigate("/");
    } catch (err) { setError(err instanceof Error ? err.message : "저장에 실패했습니다."); } finally { setIsSaving(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <SEOHead title={id ? "글 수정" : "글쓰기"} />
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-1 h-4 w-4" />뒤로</Button>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[var(--color-border)]">
            <button onClick={() => setViewMode("edit")} className={`px-3 py-1.5 text-sm ${viewMode === "edit" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)]"} rounded-l-lg`}><Edit3 className="h-4 w-4" /></button>
            <button onClick={() => setViewMode("split")} className={`px-3 py-1.5 text-sm ${viewMode === "split" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)]"}`}><Columns className="h-4 w-4" /></button>
            <button onClick={() => setViewMode("preview")} className={`px-3 py-1.5 text-sm ${viewMode === "preview" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)]"} rounded-r-lg`}><Eye className="h-4 w-4" /></button>
          </div>
          <Button variant="outline" size="sm" onClick={() => handleSave("draft")} disabled={isSaving}>임시저장</Button>
          <Button size="sm" onClick={() => handleSave("published")} disabled={isSaving}><Save className="mr-1 h-4 w-4" />{isSaving ? "저장 중..." : "발행"}</Button>
        </div>
      </div>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20">{error}</div>}
      {isUploading && <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-600 dark:bg-blue-900/20 flex items-center gap-2"><ImageIcon className="h-4 w-4 animate-pulse" />이미지 업로드 중...</div>}
      <div className="flex flex-wrap gap-3">
        <Input placeholder="제목을 입력하세요" value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 text-lg font-bold" />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"><option value="">카테고리 선택</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      <div className="flex gap-3"><Input placeholder="태그 (쉼표로 구분)" value={tags} onChange={(e) => setTags(e.target.value)} className="flex-1" /><Input placeholder="커버 이미지 URL" value={coverImage} onChange={(e) => setCoverImage(e.target.value)} className="flex-1" /></div>
      <div className="flex min-h-[500px] gap-4">
        {(viewMode === "edit" || viewMode === "split") && (
          <div className={viewMode === "split" ? "w-1/2" : "w-full"}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              placeholder="마크다운으로 내용을 입력하세요... (이미지를 붙여넣거나 드래그하면 자동 업로드됩니다)"
              className="h-full min-h-[500px] w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-mono text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
        )}
        {(viewMode === "preview" || viewMode === "split") && <Card className={viewMode === "split" ? "w-1/2 overflow-auto" : "w-full"}><CardContent className="pt-6"><div className="prose prose-lg max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: preview }} />{!preview && <p className="text-[var(--color-text-secondary)]">미리보기가 여기에 표시됩니다...</p>}</CardContent></Card>}
      </div>
    </div>
  );
}
