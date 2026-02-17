import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { Eye, Edit3, Save, ArrowLeft, ImageIcon, Upload, Loader2 } from "lucide-react";
import { Button, Input, Card, CardContent, SEOHead } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { parseMarkdown } from "@/shared/lib/markdown/parser";
import { useAuthStore } from "@/features/auth/model/store";
import { useI18n } from "@/shared/i18n";
import type { PostWithCategory, CategoryWithStats, CreatePostRequest } from "@zlog/shared";

type ViewMode = "edit" | "preview";

export default function PostEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const listFrom = (location.state as { from?: string } | null)?.from ?? "/";
  const { isAuthenticated } = useAuthStore();
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [preview, setPreview] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [categories, setCategories] = useState<CategoryWithStats[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      void navigate("/login");
    }
  }, [isAuthenticated, navigate]);
  useEffect(() => {
    void api.get<CategoryWithStats[]>("/categories").then(setCategories);
  }, []);
  useEffect(() => {
    if (!id) return;
    void api.get<PostWithCategory>(`/posts/${id}`).then((p) => {
      setTitle(p.title);
      setContent(p.content);
      setCategoryId(p.categoryId ?? "");
      setCoverImage(p.coverImage ?? "");
      setTags(p.tags.map((tg) => tg.name).join(", "));
    });
  }, [id]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void parseMarkdown(content).then((html) => {
        setPreview(html);
      });
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [content]);

  const uploadAndInsertImage = useCallback(
    async (file: File) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      setIsUploading(true);

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const placeholder = `![${t("editor_image_uploading")}](uploading)\n`;
      const before = content.slice(0, start);
      const after = content.slice(end);
      const withPlaceholder = before + placeholder + after;
      setContent(withPlaceholder);

      try {
        const fd = new FormData();
        fd.append("image", file);
        const res = await api.upload<{ url: string }>("/upload/image", fd);
        const markdown = `![${file.name}](${res.url})\n`;
        setContent((prev) => prev.replace(placeholder, markdown));
      } catch {
        setContent((prev) => prev.replace(placeholder, ""));
        setError(t("upload_failed"));
      } finally {
        setIsUploading(false);
      }
    },
    [content, t],
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) await uploadAndInsertImage(file);
          return;
        }
      }
    },
    [uploadAndInsertImage],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLTextAreaElement>) => {
      const files = e.dataTransfer.files;
      for (const file of files) {
        if (file.type.startsWith("image/")) {
          e.preventDefault();
          await uploadAndInsertImage(file);
          return;
        }
      }
    },
    [uploadAndInsertImage],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    if ([...e.dataTransfer.items].some((i) => i.type.startsWith("image/"))) {
      e.preventDefault();
    }
  }, []);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await api.upload<{ url: string }>("/upload/image", fd);
      setCoverImage(res.url);
    } catch {
      setError(t("editor_cover_upload_failed"));
    } finally {
      setIsCoverUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async (s: "draft" | "published") => {
    if (!title.trim() || !content.trim()) {
      setError(t("editor_title_content_required"));
      return;
    }
    if (s === "published" && !categoryId) {
      setError(t("editor_category_required"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const tagList = tags
        .split(",")
        .map((tg) => tg.trim())
        .filter(Boolean);
      const payload: CreatePostRequest = {
        title,
        content,
        categoryId: categoryId || undefined,
        status: s,
        tags: tagList.length > 0 ? tagList : undefined,
        coverImage: coverImage || null,
      };
      const saved = id
        ? await api.put<{ slug: string }>(`/posts/${id}`, payload)
        : await api.post<{ slug: string }>("/posts", payload);
      if (s === "published" && saved.slug) {
        void navigate(`/posts/${saved.slug}`, { state: { from: listFrom } });
      } else {
        void navigate(listFrom);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("request_failed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SEOHead title={id ? t("editor_edit_post") : t("editor_new_post")} />
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void navigate(-1);
          }}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("editor_back")}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void handleSave("draft");
            }}
            disabled={isSaving}
          >
            {t("editor_draft")}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              void handleSave("published");
            }}
            disabled={isSaving}
          >
            <Save className="mr-1 h-4 w-4" />
            {isSaving ? t("loading") : t("editor_publish")}
          </Button>
        </div>
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20">
          {error}
        </div>
      )}
      {isUploading && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-600 dark:bg-blue-900/20">
          <ImageIcon className="h-4 w-4 animate-pulse" />
          {t("editor_image_uploading")}
        </div>
      )}
      <div className="border-border flex border-b">
        <button
          type="button"
          onClick={() => {
            setViewMode("edit");
          }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${viewMode === "edit" ? "border-primary text-primary border-b-2" : "text-text-secondary hover:text-text"}`}
        >
          <Edit3 className="h-4 w-4" />
          {t("edit")}
        </button>
        <button
          type="button"
          onClick={() => {
            setViewMode("preview");
          }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${viewMode === "preview" ? "border-primary text-primary border-b-2" : "text-text-secondary hover:text-text"}`}
        >
          <Eye className="h-4 w-4" />
          {t("preview")}
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder={t("editor_title_placeholder")}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
          className="flex-1 text-lg font-bold"
        />
        <select
          value={categoryId}
          title={t("editor_category_select")}
          aria-label={t("editor_category_select")}
          onChange={(e) => {
            setCategoryId(e.target.value);
          }}
          className="border-border bg-surface text-text rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">{t("editor_category_select")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-3">
        <Input
          placeholder={t("editor_tag_placeholder")}
          value={tags}
          onChange={(e) => {
            setTags(e.target.value);
          }}
          className="flex-1"
        />
        <div className="flex flex-1 items-center gap-2">
          <Input
            placeholder={t("editor_cover_image_placeholder")}
            value={coverImage}
            onChange={(e) => {
              setCoverImage(e.target.value);
            }}
            className="flex-1"
          />
          <label className="border-border text-text hover:bg-background inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border px-2 py-1.5 text-xs">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverUpload}
              disabled={isCoverUploading}
            />
            {isCoverUploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            {isCoverUploading ? t("uploading") : t("upload")}
          </label>
          {coverImage && (
            <button
              type="button"
              onClick={() => {
                setCoverImage("");
              }}
              className="shrink-0 text-xs text-red-500 hover:underline"
            >
              {t("editor_cover_delete")}
            </button>
          )}
        </div>
      </div>
      <div className="min-h-125">
        {viewMode === "edit" && (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
            }}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            placeholder={t("editor_content_placeholder")}
            className="border-border bg-surface text-text placeholder:text-text-secondary focus:ring-primary h-full min-h-125 w-full resize-none rounded-lg border p-4 font-mono text-sm focus:ring-2 focus:outline-none"
          />
        )}
        {viewMode === "preview" && (
          <Card className="w-full">
            <CardContent className="pt-6">
              <div
                className="prose prose-lg dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: preview }}
              />
              {!preview && <p className="text-text-secondary">{t("preview")}...</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
