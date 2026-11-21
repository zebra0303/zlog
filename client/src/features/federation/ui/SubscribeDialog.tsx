import { useEffect, useId, useRef, useState } from "react";
import { Rss, Info, X, ExternalLink, ChevronDown } from "lucide-react";
import { Input, Button } from "@/shared/ui";
import { useI18n } from "@/shared/i18n";
import type { CategoryWithStats } from "@zlog/shared";

interface SubscribeDialogProps {
  /** Pre-selected category. When omitted, a category dropdown is rendered from `categories`. */
  category?: CategoryWithStats;
  categories?: CategoryWithStats[];
  onClose: () => void;
}

/**
 * Shared federation subscribe dialog reused by HomePage and CategoryDetailPage.
 * Enforces http(s) URL validation and blocks self-subscription consistently.
 */
export function SubscribeDialog({ category, categories = [], onClose }: SubscribeDialogProps) {
  const [blogUrl, setBlogUrl] = useState("");
  const [selectedCat, setSelectedCat] = useState<CategoryWithStats | null>(category ?? null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const { t } = useI18n();

  const normalizedBlogUrl = blogUrl.trim().replace(/\/$/, "");
  const isValidUrl = /^https?:\/\/.+/.test(normalizedBlogUrl);
  const isSelfUrl =
    isValidUrl &&
    normalizedBlogUrl.replace(/\/$/, "") === window.location.origin.replace(/\/$/, "");

  useEffect(() => {
    if (selectedCat) {
      inputRef.current?.focus();
    }
  }, [selectedCat]);

  // Allow closing with Escape key for WCAG keyboard accessibility
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const handleSubscribe = () => {
    if (!isValidUrl || !selectedCat || isSelfUrl) return;
    const remoteSiteUrl = window.location.origin;
    const params = new URLSearchParams({
      action: "subscribe",
      remoteUrl: remoteSiteUrl,
      remoteCatId: selectedCat.id,
      remoteCatName: selectedCat.name,
      remoteCatSlug: selectedCat.slug,
    });
    const adminUrl = `${normalizedBlogUrl}/admin?${params.toString()}`;
    window.open(adminUrl, "_blank", "noopener");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="border-border bg-surface w-full max-w-lg rounded-xl border shadow-xl"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="border-border flex items-center justify-between border-b p-4">
          <h2 id={titleId} className="text-text flex items-center gap-2 text-lg font-semibold">
            <Rss className="text-primary h-5 w-5" />
            {selectedCat ? (
              <>
                {t("cat_subscribe_title")} &quot;{selectedCat.name}&quot;{" "}
                {t("cat_subscribe_category")}
              </>
            ) : (
              t("cat_subscribe_select_from_list")
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="text-text-secondary hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          <div className="bg-background mb-4 rounded-lg p-3">
            <div className="mb-2 flex items-start gap-2">
              <Info className="text-primary mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <h3 className="text-text text-sm font-medium">{t("cat_subscribe_what")}</h3>
                <p className="text-text-secondary mt-1 text-xs leading-relaxed">
                  {t("cat_subscribe_desc1")} {t("cat_subscribe_desc2")}
                </p>
                <p className="text-text-secondary mt-1 text-xs leading-relaxed">
                  {t("cat_subscribe_desc3_v2")}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {!category && (
              <div>
                <label className="text-text mb-1 block text-sm font-medium">
                  {t("cat_subscribe_select_category")}
                </label>
                <div className="relative">
                  <select
                    value={selectedCat?.id ?? ""}
                    onChange={(e) => {
                      const cat = categories.find((c) => c.id === e.target.value) ?? null;
                      setSelectedCat(cat);
                    }}
                    className="border-border bg-surface text-text focus:border-primary w-full cursor-pointer appearance-none rounded-md border py-2 pr-9 pl-3 text-sm transition-colors focus:outline-none"
                    aria-label={t("cat_subscribe_select_category")}
                  >
                    <option value="">{t("cat_subscribe_select_placeholder")}</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="text-text-secondary pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
                </div>
              </div>
            )}
            <div>
              <label className="text-text mb-1 block text-sm font-medium">
                {t("cat_subscribe_blog_url")}
              </label>
              <Input
                ref={inputRef}
                placeholder="https://myblog.example.com"
                value={blogUrl}
                onChange={(e) => {
                  setBlogUrl(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubscribe();
                }}
                disabled={!selectedCat}
              />
              {normalizedBlogUrl && !isValidUrl && (
                <p role="alert" className="mt-1 text-xs text-red-500">
                  {t("cat_subscribe_invalid_url")}
                </p>
              )}
              {isSelfUrl && (
                <p role="alert" className="mt-1 text-xs text-red-500">
                  {t("cat_subscribe_self_url")}
                </p>
              )}
            </div>
            {normalizedBlogUrl && isValidUrl && !isSelfUrl && (
              <div className="bg-background text-text-secondary flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {t("cat_subscribe_redirect_desc", { url: normalizedBlogUrl })}
                </span>
              </div>
            )}
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSubscribe}
                disabled={!isValidUrl || !selectedCat || isSelfUrl}
              >
                <ExternalLink className="mr-1 h-4 w-4" />
                {t("cat_subscribe_go_admin")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
