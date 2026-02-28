import { useEffect, useState } from "react";
import { Rss, Trash2 } from "lucide-react";
import { Button, Card, CardContent, Badge } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n";

interface Subscriber {
  id: string;
  categoryId: string;
  categoryName: string | null;
  subscriberUrl: string;
  callbackUrl: string;
  isActive: boolean;
  createdAt: string;
}

export function SubscriberManager() {
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
                  <Trash2 className="h-4 w-4 text-[var(--color-destructive)]" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
