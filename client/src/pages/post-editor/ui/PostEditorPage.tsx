import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { Eye, Edit3, Save, ArrowLeft, ImageIcon, Upload, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, CardContent, SEOHead, MarkdownToolbar } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { parseMarkdown } from "@/shared/lib/markdown/parser";
import { useAuthStore } from "@/features/auth/model/store";
import { useI18n } from "@/shared/i18n";
import { getErrorMessage } from "@/shared/lib/getErrorMessage";
import type {
  PostWithCategory,
  CategoryWithStats,
  CreatePostRequest,
  PostTemplate,
} from "@zlog/shared";

type ViewMode = "edit" | "preview";

export default function PostEditorPage() {
  const sanitizeCoverImageUrl = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "";

    // Allow relative URLs (they don't have a protocol)
    try {
      const url = new URL(trimmed, window.location.origin);
      const protocol = url.protocol.toLowerCase();

      if (protocol === "http:" || protocol === "https:") {
        return trimmed;
      }

      // Optionally allow data URLs for images only
      if (protocol === "data:" && trimmed.toLowerCase().startsWith("data:image/")) {
        return trimmed;
      }

      // Disallow all other protocols (e.g., javascript:, vbscript:, file:, etc.)
      return "";
    } catch {
      // If URL construction fails, keep the original if it looks like a relative path
      if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
        return trimmed;
      }
      return "";
    }
  };

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const listFrom = (location.state as { from?: string } | null)?.from ?? "/";
  const { isAuthenticated } = useAuthStore();
  const { t } = useI18n();
  const queryClient = useQueryClient();

  // Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState("");
  const [coverImage, setCoverImage] = useState("");

  // UI State
  const [sanitizedHtml, setSanitizedHtml] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCoverUploading, setIsCoverUploading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolbarFileRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<CategoryWithStats[]>("/categories"),
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => api.get<string[]>("/posts/tags").catch(() => []),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: () => api.get<PostTemplate[]>("/templates").catch(() => []),
  });

  const { data: post } = useQuery({
    queryKey: ["post", id],
    queryFn: () => api.get<PostWithCategory>(`/posts/${id}`),
    enabled: !!id,
  });

  const handleTemplateSelect = (templateId: string) => {
    if (!templateId) return;
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    if (content.trim() && !confirm(t("editor_template_confirm"))) {
      return;
    }

    setContent(template.content);
  };

  // Sync post data to form
  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setContent(post.content);
      setCategoryId(post.categoryId ?? "");
      setCoverImage(post.coverImage ?? "");
      setTags(post.tags.map((tg) => tg.name).join(", "));
    }
  }, [post]);

  // Auth check
  useEffect(() => {
    if (!isAuthenticated) {
      void navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // Tag suggestions
  useEffect(() => {
    const parts = tags.split(",");
    const lastPart = parts[parts.length - 1]?.trim().toLowerCase();
    if (!lastPart) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const existingTags = new Set(parts.slice(0, -1).map((t) => t.trim().toLowerCase()));
    const matches = allTags
      .filter(
        (t) =>
          t.toLowerCase().startsWith(lastPart) &&
          !existingTags.has(t.toLowerCase()) &&
          t.toLowerCase() !== lastPart,
      )
      .slice(0, 5);
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
    setHighlightedIndex(0);
  }, [tags, allTags]);

  const handleSuggestionClick = (suggestion: string) => {
    const parts = tags.split(",");
    parts[parts.length - 1] = ` ${suggestion}`;
    setTags(`${parts.join(", ")}, `);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      const selected = suggestions[highlightedIndex];
      if (selected) handleSuggestionClick(selected);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // Markdown preview debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      void parseMarkdown(content).then((html) => {
        setSanitizedHtml(html);
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

      setError(null);
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

  // Tab / Shift+Tab indent/outdent + Enter auto-continue list handler
  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { selectionStart, selectionEnd, value } = textarea;

      // Enter key: auto-continue list items (skip during IME composition)
      if (
        e.key === "Enter" &&
        !e.nativeEvent.isComposing &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        selectionStart === selectionEnd
      ) {
        const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
        const currentLine = value.slice(lineStart, selectionStart);
        const listMatch = /^(\s*)([-*]|\d+\.)\s/.exec(currentLine);

        if (listMatch) {
          e.preventDefault();
          const [, indent, marker] = listMatch;
          const emptyMatch = /^(\s*)([-*]|\d+\.)\s*$/.exec(currentLine);

          if (emptyMatch) {
            // Empty list item — remove marker to end the list
            const newValue = value.slice(0, lineStart) + "\n" + value.slice(selectionStart);
            setContent(newValue);
            const newCursor = lineStart + 1;
            requestAnimationFrame(() => {
              textarea.selectionStart = textarea.selectionEnd = newCursor;
            });
          } else {
            // Continue list: always use "1." for ordered lists (markdown auto-numbers)
            const nextMarker = /^\d+\./.test(marker ?? "") ? "1." : marker;
            const insertion = `\n${indent}${nextMarker} `;
            const newValue = value.slice(0, selectionStart) + insertion + value.slice(selectionEnd);
            setContent(newValue);
            const newCursor = selectionStart + insertion.length;
            requestAnimationFrame(() => {
              textarea.selectionStart = textarea.selectionEnd = newCursor;
            });
          }
          return;
        }
      }

      if (e.key !== "Tab") return;
      e.preventDefault();

      // Uniform 3-space indent for both ordered and unordered lists
      const indent = "   ";

      if (selectionStart === selectionEnd) {
        // No selection — single cursor
        const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
        if (e.shiftKey) {
          // Outdent: remove up to 3 leading spaces
          const linePrefix = value.slice(lineStart, selectionStart);
          const spacesToRemove = linePrefix.startsWith("   ")
            ? 3
            : linePrefix.startsWith("  ")
              ? 2
              : linePrefix.startsWith(" ")
                ? 1
                : 0;
          if (spacesToRemove === 0) return;
          const newValue = value.slice(0, lineStart) + value.slice(lineStart + spacesToRemove);
          setContent(newValue);
          const newCursor = selectionStart - spacesToRemove;
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd = newCursor;
          });
        } else {
          // Indent: insert 3 spaces at line start
          const newValue = value.slice(0, lineStart) + indent + value.slice(lineStart);
          setContent(newValue);
          const newCursor = selectionStart + indent.length;
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd = newCursor;
          });
        }
      } else {
        // Block selection — indent/outdent each line
        const blockStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
        const selectedText = value.slice(blockStart, selectionEnd);
        const lines = selectedText.split("\n");
        let offset = 0; // cumulative shift for selectionStart line
        let totalOffset = 0;
        const firstLineStart = blockStart;

        const newLines = lines.map((line, i) => {
          if (e.shiftKey) {
            const spacesToRemove = line.startsWith("   ")
              ? 3
              : line.startsWith("  ")
                ? 2
                : line.startsWith(" ")
                  ? 1
                  : 0;
            if (i === 0) offset = -spacesToRemove;
            totalOffset -= spacesToRemove;
            return line.slice(spacesToRemove);
          } else {
            if (i === 0) offset = indent.length;
            totalOffset += indent.length;
            return indent + line;
          }
        });

        const newValue =
          value.slice(0, firstLineStart) + newLines.join("\n") + value.slice(selectionEnd);
        setContent(newValue);
        const newStart = Math.max(firstLineStart, selectionStart + offset);
        const newEnd = selectionEnd + totalOffset;
        requestAnimationFrame(() => {
          textarea.selectionStart = newStart;
          textarea.selectionEnd = newEnd;
        });
      }
    },
    [setContent],
  );

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
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

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreatePostRequest) => api.post<{ slug: string }>("/posts", payload),
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
      if (variables.status === "published" && data.slug) {
        void navigate(`/posts/${data.slug}`, { state: { from: listFrom } });
      } else {
        void navigate(listFrom);
      }
    },
    onError: (err) => {
      setError(getErrorMessage(err, t("request_failed")));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: CreatePostRequest) => api.put<{ slug: string }>(`/posts/${id}`, payload),
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
      void queryClient.invalidateQueries({ queryKey: ["post", id] });
      if (variables.status === "published" && data.slug) {
        void navigate(`/posts/${data.slug}`, { state: { from: listFrom } });
      } else {
        void navigate(listFrom);
      }
    },
    onError: (err) => {
      setError(getErrorMessage(err, t("request_failed")));
    },
  });

  const handleSave = (s: "draft" | "published") => {
    if (!title.trim() || !content.trim()) {
      setError(t("editor_title_content_required"));
      return;
    }
    if (s === "published" && !categoryId) {
      setError(t("editor_category_required"));
      return;
    }
    setError(null);

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

    if (id) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

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
              handleSave("draft");
            }}
            disabled={isSaving}
          >
            {t("editor_draft")}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              handleSave("published");
            }}
            disabled={isSaving}
          >
            <Save className="mr-1 h-4 w-4" />
            {isSaving ? t("loading") : t("editor_publish")}
          </Button>
        </div>
      </div>
      {error && (
        <div className="rounded-lg bg-[var(--color-destructive-light)] p-3 text-sm text-[var(--color-destructive)]">
          {error}
        </div>
      )}
      {isUploading && (
        <div className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)]/10 p-3 text-sm text-[var(--color-primary)]">
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
      {/* Mobile: stack title above category+template; Desktop: single row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Input
          placeholder={t("editor_title_placeholder")}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
          className="min-w-0 flex-1 text-lg font-bold"
        />
        <div className="flex gap-3">
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

          {templates.length > 0 && (
            <select
              value=""
              title={t("editor_template_select")}
              aria-label={t("editor_template_select")}
              onChange={(e) => {
                handleTemplateSelect(e.target.value);
              }}
              className="border-border bg-surface text-text rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">{t("editor_template_select")}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {/* Mobile: stack tags above cover image; Desktop: side by side */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative sm:flex-1">
          <Input
            placeholder={t("editor_tag_placeholder")}
            value={tags}
            onChange={(e) => {
              setTags(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              // Delay hiding so click event can fire
              setTimeout(() => {
                setShowSuggestions(false);
              }, 200);
            }}
            className="w-full"
            autoComplete="off"
          />
          {showSuggestions && (
            <div className="border-border bg-surface absolute top-full left-0 z-10 mt-1 w-full overflow-hidden rounded-lg border shadow-lg">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  className={`hover:bg-background/80 block w-full px-3 py-2 text-left text-sm ${index === highlightedIndex ? "bg-primary/10 text-primary" : "text-text"}`}
                  onClick={() => {
                    handleSuggestionClick(suggestion);
                  }}
                  onMouseEnter={() => {
                    setHighlightedIndex(index);
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 sm:flex-1">
          <Input
            placeholder={t("editor_cover_image_placeholder")}
            value={coverImage}
            onChange={(e) => {
              const safeValue = sanitizeCoverImageUrl(e.target.value);
              setCoverImage(safeValue);
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
                setError(null);
                setCoverImage("");
              }}
              className="shrink-0 text-xs text-[var(--color-destructive)] hover:underline"
            >
              {t("editor_cover_delete")}
            </button>
          )}
        </div>
      </div>
      <div>
        <input
          ref={toolbarFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadAndInsertImage(file);
            e.target.value = "";
          }}
        />
        {viewMode === "edit" && (
          <>
            <MarkdownToolbar
              textareaRef={textareaRef}
              value={content}
              onChange={setContent}
              onImageUpload={() => toolbarFileRef.current?.click()}
            />
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
              }}
              onKeyDown={handleTextareaKeyDown}
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              placeholder={t("editor_content_placeholder")}
              className="border-border bg-surface text-text placeholder:text-text-secondary focus:ring-primary min-h-[calc(100vh-22rem)] w-full resize-y rounded-lg rounded-t-none border border-t-0 p-4 font-mono text-sm focus:ring-2 focus:outline-none"
            />
          </>
        )}
        {viewMode === "preview" && (
          <>
            {coverImage && (
              <img
                src={coverImage}
                alt={title || "Cover"}
                className="mb-4 h-auto w-full rounded-xl"
              />
            )}
            <Card className="w-full">
              <CardContent className="pt-6">
                {/* 
                  CodeQL Alert: DOM text reinterpreted as HTML
                  False Positive: `sanitizedHtml` is generated by `parseMarkdown` which explicitly uses 
                  `rehype-sanitize` to strip unsafe HTML tags and attributes (XSS protection).
                  Post-processing steps in `parseMarkdown` also encode user input (e.g. mermaid blocks).
                */}
                <div
                  className="prose prose-lg dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
                {!sanitizedHtml && <p className="text-text-secondary">{t("preview")}...</p>}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
