import { useCallback, useEffect, useState, useRef } from "react";
import { FileText, Plus, Pencil, Trash2, X, Save, Loader2, Edit3, Eye } from "lucide-react";
import { Button, Input, Textarea, Card, CardContent, MarkdownToolbar } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n";
import { parseMarkdown } from "@/shared/lib/markdown/parser";
import type { PostTemplate } from "@zlog/shared";

export function TemplateManager() {
  const [templates, setTemplates] = useState<PostTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");

  const newTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Preview mode states for new/edit template editors
  const [newPreviewMode, setNewPreviewMode] = useState(false);
  const [newPreviewHtml, setNewPreviewHtml] = useState("");
  const [editPreviewMode, setEditPreviewMode] = useState(false);
  const [editPreviewHtml, setEditPreviewHtml] = useState("");

  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  const fetchTemplates = useCallback(() => {
    setIsLoading(true);
    void api
      .get<PostTemplate[]>("/templates")
      .then((data) => {
        setTemplates(data);
        setIsLoading(false);
      })
      .catch(() => {
        setError(t("request_failed"));
        setIsLoading(false);
      });
  }, [t]);

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) {
      setError(t("admin_template_name_required"));
      return;
    }
    if (!newContent.trim()) {
      setError(t("admin_template_content_required"));
      return;
    }
    setError(null);
    try {
      await api.post("/templates", {
        name: newName,
        content: newContent,
      });
      setNewName("");
      setNewContent("");
      setIsAdding(false);
      setNewPreviewMode(false);
      fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin_template_create_failed"));
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) {
      setError(t("admin_template_name_required"));
      return;
    }
    if (!editContent.trim()) {
      setError(t("admin_template_content_required"));
      return;
    }
    setError(null);
    try {
      await api.put(`/templates/${id}`, {
        name: editName,
        content: editContent,
      });
      setEditingId(null);
      fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin_template_update_failed"));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t("admin_template_delete_confirm", { name }))) return;
    try {
      await api.delete(`/templates/${id}`);
      fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin_template_delete_failed"));
    }
  };

  const startEdit = (tpl: PostTemplate) => {
    setEditingId(tpl.id);
    setEditName(tpl.name);
    setEditContent(tpl.content);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
            <FileText className="h-5 w-5" />
            {t("admin_template_title")}
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
              {t("admin_template_add")}
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-[var(--color-destructive-light)] p-3 text-sm text-[var(--color-destructive)]">
            {error}
          </div>
        )}

        {isAdding && (
          <div className="mb-6 rounded-lg border border-[var(--color-primary)] bg-[var(--color-surface)] p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--color-primary)]">
                {t("admin_template_new")}
              </h3>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewPreviewMode(false);
                }}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <Input
                placeholder={t("admin_template_name_placeholder")}
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                }}
              />
              {/* Edit/Preview toggle */}
              <div>
                <div className="mb-1 flex justify-end">
                  <div className="flex rounded-lg border border-[var(--color-border)]">
                    <button
                      onClick={() => {
                        setNewPreviewMode(false);
                      }}
                      className={`flex items-center gap-1 px-3 py-1 text-xs ${!newPreviewMode ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)]"} rounded-l-lg`}
                    >
                      <Edit3 className="h-3 w-3" />
                      {t("settings_about_edit")}
                    </button>
                    <button
                      onClick={async () => {
                        setNewPreviewHtml(await parseMarkdown(newContent));
                        setNewPreviewMode(true);
                      }}
                      className={`flex items-center gap-1 px-3 py-1 text-xs ${newPreviewMode ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)]"} rounded-r-lg`}
                    >
                      <Eye className="h-3 w-3" />
                      {t("settings_about_preview")}
                    </button>
                  </div>
                </div>
                {newPreviewMode ? (
                  <div className="min-h-[240px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                    {newPreviewHtml ? (
                      <div
                        className="prose dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: newPreviewHtml }}
                      />
                    ) : (
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {t("settings_about_empty")}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <MarkdownToolbar
                      textareaRef={newTextareaRef}
                      value={newContent}
                      onChange={setNewContent}
                    />
                    <Textarea
                      ref={newTextareaRef}
                      placeholder={t("admin_template_content_placeholder")}
                      value={newContent}
                      onChange={(e) => {
                        setNewContent(e.target.value);
                      }}
                      rows={10}
                      className="rounded-t-none border-t-0 font-mono text-sm"
                    />
                  </>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={handleCreate}>
                  <Save className="mr-1 h-4 w-4" />
                  {t("save")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--color-text-secondary)]" />
          </div>
        ) : templates.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
            {t("admin_template_empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
              >
                {editingId === tpl.id ? (
                  <div className="flex flex-col gap-3">
                    <Input
                      value={editName}
                      onChange={(e) => {
                        setEditName(e.target.value);
                      }}
                    />
                    {/* Edit/Preview toggle */}
                    <div>
                      <div className="mb-1 flex justify-end">
                        <div className="flex rounded-lg border border-[var(--color-border)]">
                          <button
                            onClick={() => {
                              setEditPreviewMode(false);
                            }}
                            className={`flex items-center gap-1 px-3 py-1 text-xs ${!editPreviewMode ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)]"} rounded-l-lg`}
                          >
                            <Edit3 className="h-3 w-3" />
                            {t("settings_about_edit")}
                          </button>
                          <button
                            onClick={async () => {
                              setEditPreviewHtml(await parseMarkdown(editContent));
                              setEditPreviewMode(true);
                            }}
                            className={`flex items-center gap-1 px-3 py-1 text-xs ${editPreviewMode ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)]"} rounded-r-lg`}
                          >
                            <Eye className="h-3 w-3" />
                            {t("settings_about_preview")}
                          </button>
                        </div>
                      </div>
                      {editPreviewMode ? (
                        <div className="min-h-[240px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                          {editPreviewHtml ? (
                            <div
                              className="prose dark:prose-invert max-w-none"
                              dangerouslySetInnerHTML={{ __html: editPreviewHtml }}
                            />
                          ) : (
                            <p className="text-sm text-[var(--color-text-secondary)]">
                              {t("settings_about_empty")}
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          <MarkdownToolbar
                            textareaRef={editTextareaRef}
                            value={editContent}
                            onChange={setEditContent}
                          />
                          <Textarea
                            ref={editTextareaRef}
                            value={editContent}
                            onChange={(e) => {
                              setEditContent(e.target.value);
                            }}
                            rows={10}
                            className="rounded-t-none border-t-0 font-mono text-sm"
                          />
                        </>
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(null);
                          setEditPreviewMode(false);
                        }}
                      >
                        {t("cancel")}
                      </Button>
                      <Button size="sm" onClick={() => handleUpdate(tpl.id)}>
                        <Save className="mr-1 h-4 w-4" />
                        {t("save")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-[var(--color-text)]">{tpl.name}</h3>
                      <p className="mt-1 line-clamp-1 font-mono text-xs text-[var(--color-text-secondary)]">
                        {tpl.content}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          startEdit(tpl);
                        }}
                        aria-label={t("edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          void handleDelete(tpl.id, tpl.name);
                        }}
                        aria-label={t("delete")}
                      >
                        <Trash2 className="h-4 w-4 text-[var(--color-destructive)]" />
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
