import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Loader2, RefreshCw, Link2, Power } from "lucide-react";
import { Button, Input, Card, CardContent, Badge } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n";
import { getFederationErrorMessage } from "@/shared/lib/getErrorMessage";
import type { CategoryWithStats } from "@zlog/shared";

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

export interface SubscribeActionParams {
  remoteUrl: string;
  remoteCatId: string;
  remoteCatName: string;
  remoteCatSlug: string;
}

export function SubscriptionManager({
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

  // Normalize URL helper
  const normalizeUrl = (raw: string): string => {
    let url = raw;
    if (!url.startsWith("http")) {
      if (url.startsWith("localhost") || url.startsWith("127.0.0.1")) {
        url = `http://${url}`;
      } else {
        url = `https://${url}`;
      }
    }
    return url.replace(/\/+$/, "");
  };

  // Auto-open via subscribeAction
  const actionProcessed = useRef(false);
  useEffect(() => {
    if (!subscribeAction || actionProcessed.current) return;
    actionProcessed.current = true;
    setShowAddForm(true);
    const url = normalizeUrl(subscribeAction.remoteUrl);
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
        const text = getFederationErrorMessage(err, t("admin_mysub_add_fetch_failed"), t);
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
    const rawUrl = addUrl.trim();
    if (!rawUrl) return;
    const url = normalizeUrl(rawUrl);
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
      const text = getFederationErrorMessage(err, t("admin_mysub_add_fetch_failed"), t);
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
      const text = getFederationErrorMessage(err, t("admin_mysub_add_subscribe_failed"), t);
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
      const text = getFederationErrorMessage(err, t("admin_mysub_sync_failed"), t);
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
                  className={`text-xs ${addMessage.type === "success" ? "text-[var(--color-success)]" : "text-[var(--color-destructive)]"}`}
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
                        <Badge variant="destructive">{t("admin_mysub_inactive")}</Badge>
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
                        className={`mt-1 text-xs ${syncMessage.type === "success" ? "text-[var(--color-success)]" : "text-[var(--color-destructive)]"}`}
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
                      onClick={() => handleDelete(sub)}
                      aria-label={t("delete")}
                    >
                      <Trash2 className="h-4 w-4 text-[var(--color-destructive)]" />
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
