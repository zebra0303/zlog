import { useCallback, useEffect, useState } from "react";
import { Folder, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button, Input, Card, CardContent, Badge, ToggleSwitch } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n";
import { getErrorMessage } from "@/shared/lib/getErrorMessage";
import type { CategoryWithStats } from "@zlog/shared";

export function CategoryManager() {
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
      setError(getErrorMessage(err, t("admin_cat_create_failed")));
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
      setError(getErrorMessage(err, t("admin_cat_update_failed")));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t("admin_cat_delete_confirm", { name }))) return;
    try {
      await api.delete(`/categories/${id}`);
      fetchCategories();
    } catch (err) {
      setError(getErrorMessage(err, t("admin_cat_delete_failed")));
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
          <div className="mb-3 rounded-lg bg-[var(--color-destructive-light)] p-3 text-sm text-[var(--color-destructive)]">
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
                <ToggleSwitch
                  checked={newIsPublic}
                  onToggle={() => {
                    setNewIsPublic(!newIsPublic);
                  }}
                  label={t("public")}
                />
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
              <div
                key={cat.id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
              >
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
                      <ToggleSwitch
                        checked={editIsPublic}
                        onToggle={() => {
                          setEditIsPublic(!editIsPublic);
                        }}
                        label={t("public")}
                      />
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
                        onClick={() => handleDelete(cat.id, cat.name)}
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
