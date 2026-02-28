import { useEffect, useState } from "react";
import { useThemeStore } from "@/features/toggle-theme/model/store";
import { useNavigate, useSearchParams } from "react-router";
import {
  Settings,
  FileText,
  Globe,
  Save,
  Palette,
  Languages,
  Activity,
  ChevronDown,
} from "lucide-react";
import { Button, Input, Textarea, Card, CardContent, SEOHead, ToggleSwitch } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useAuthStore } from "@/features/auth/model/store";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";
import { useI18n } from "@/shared/i18n";
import { VisitorStats } from "@/features/visitor-analytics/ui";
import { applyFont } from "@/shared/lib/fonts";
import { TemplateManager } from "./TemplateManager";
import { PostManager } from "./PostManager";
import { CategoryManager } from "./CategoryManager";
import { ThemeCustomizer } from "./ThemeCustomizer";
import { SubscriptionManager } from "./SubscriptionManager";
import { SubscriberManager } from "./SubscriberManager";

// ============ Main AdminPage ============
type AdminTab = "general" | "content" | "theme" | "federation";

export default function AdminPage() {
  const { isAuthenticated } = useAuthStore();
  const { fetchSettings: refreshSiteSettings, getCurrentFont } = useSiteSettingsStore();
  const { isDark } = useThemeStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [testingSlack, setTestingSlack] = useState(false);
  const [slackTestResult, setSlackTestResult] = useState<"ok" | "error" | null>(null);

  // Restore font on unmount
  useEffect(() => {
    return () => {
      // Re-apply the font from the store (last saved state) when leaving admin page
      const currentFont = getCurrentFont();
      applyFont(currentFont);
    };
  }, [getCurrentFont]);

  // Live preview: apply body background, primary color, and CSS variable overrides as settings change
  useEffect(() => {
    if (Object.keys(settings).length === 0) return;

    const from = isDark ? settings.body_bg_color_dark : settings.body_bg_color_light;
    const to = isDark ? settings.body_bg_gradient_to_dark : settings.body_bg_gradient_to_light;
    const dir = isDark
      ? settings.body_bg_gradient_direction_dark
      : settings.body_bg_gradient_direction_light;
    const mid = isDark
      ? settings.body_bg_gradient_midpoint_dark
      : settings.body_bg_gradient_midpoint_light;

    if (!from) {
      document.body.style.background = "";
      document.body.style.backgroundColor = "";
    } else if (to) {
      document.body.style.background = `linear-gradient(${dir ?? "to bottom"}, ${from} ${mid ? mid + "%" : ""}, ${to})`;
      document.body.style.backgroundColor = "";
    } else {
      document.body.style.background = "";
      document.body.style.backgroundColor = from;
    }

    if (settings.primary_color) {
      document.documentElement.style.setProperty("--color-primary", settings.primary_color);
    } else {
      document.documentElement.style.removeProperty("--color-primary");
    }

    const surfaceColor = isDark ? settings.surface_color_dark : settings.surface_color_light;
    if (surfaceColor) {
      document.documentElement.style.setProperty("--color-surface", surfaceColor);
    } else {
      document.documentElement.style.removeProperty("--color-surface");
    }

    const textColor = isDark ? settings.text_color_dark : settings.text_color_light;
    if (textColor) {
      document.documentElement.style.setProperty("--color-text", textColor);
    } else {
      document.documentElement.style.removeProperty("--color-text");
    }

    return () => {
      document.body.style.background = "";
      document.body.style.backgroundColor = "";
      document.documentElement.style.removeProperty("--color-primary");
      document.documentElement.style.removeProperty("--color-surface");
      document.documentElement.style.removeProperty("--color-text");
    };
  }, [isDark, settings]);

  // Tab state — switch to Federation tab if subscribe action is present
  const tabParam = searchParams.get("tab");
  const hasSubscribeAction = searchParams.get("action") === "subscribe";
  const [activeTab, setActiveTab] = useState<AdminTab>(
    hasSubscribeAction
      ? "federation"
      : tabParam === "content" || tabParam === "theme" || tabParam === "federation"
        ? tabParam
        : "general",
  );

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    if (tab === "general") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    // Don't preserve subscribe action params when changing tabs
    if (tab !== "federation") {
      params.delete("action");
      params.delete("remoteUrl");
      params.delete("remoteCatId");
      params.delete("remoteCatName");
      params.delete("remoteCatSlug");
    }
    setSearchParams(params, { replace: true });
  };

  // Detect subscribe action query parameters
  const subscribeAction =
    searchParams.get("action") === "subscribe"
      ? {
          remoteUrl: searchParams.get("remoteUrl") ?? "",
          remoteCatId: searchParams.get("remoteCatId") ?? "",
          remoteCatName: searchParams.get("remoteCatName") ?? "",
          remoteCatSlug: searchParams.get("remoteCatSlug") ?? "",
        }
      : null;

  useEffect(() => {
    if (!isAuthenticated) {
      // Redirect to current URL (including query params) after login
      const currentPath = window.location.pathname + window.location.search;
      void navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }
    void api.get<Record<string, string>>("/settings").then(setSettings);
  }, [isAuthenticated, navigate]);

  const update = (k: string, v: string) => {
    setSettings((p) => ({ ...p, [k]: v }));
  };
  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await api.put("/settings", settings);
      await refreshSiteSettings();
      setMessage(useI18n.getState().t("admin_saved"));
    } catch {
      setMessage(useI18n.getState().t("admin_save_failed"));
    } finally {
      setIsSaving(false);
    }
  };

  const { t, setLocale, locale } = useI18n();
  const desc = settings.seo_description ?? "";
  const title = settings.blog_title ?? "";

  const handleLanguageChange = (lang: string) => {
    update("default_language", lang);
    setLocale(lang as "en" | "ko");
  };

  const handleTestSlack = async () => {
    setTestingSlack(true);
    setSlackTestResult(null);
    try {
      await api.post("/settings/test-slack", {});
      setSlackTestResult("ok");
    } catch {
      setSlackTestResult("error");
    } finally {
      setTestingSlack(false);
    }
  };

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode; emoji: string }[] = [
    {
      key: "general",
      label: t("admin_tab_general"),
      icon: <Settings className="h-4 w-4" />,
      emoji: "⚙️",
    },
    {
      key: "content",
      label: t("admin_tab_content"),
      icon: <FileText className="h-4 w-4" />,
      emoji: "📝",
    },
    {
      key: "theme",
      label: t("admin_tab_theme"),
      icon: <Palette className="h-4 w-4" />,
      emoji: "🎨",
    },
    {
      key: "federation",
      label: t("admin_tab_federation"),
      icon: <Globe className="h-4 w-4" />,
      emoji: "🌐",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SEOHead title={t("admin_title")} />
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--color-text)]">
          <Settings className="h-6 w-6" />
          {t("admin_title")}
        </h1>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-1 h-4 w-4" />
          {isSaving ? t("admin_saving") : t("admin_save")}
        </Button>
      </div>
      {message && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20">
          {message}
        </div>
      )}

      {/* Mobile-only Visitor Stats */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm lg:hidden">
        <VisitorStats />
      </div>

      {/* Tab navigation — select on mobile, buttons on desktop */}
      <div className="relative sm:hidden">
        <select
          value={activeTab}
          onChange={(e) => {
            handleTabChange(e.target.value as AdminTab);
          }}
          className="w-full appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 pr-8 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
        >
          {tabs.map((tab) => (
            <option key={tab.key} value={tab.key}>
              {tab.emoji} {tab.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[var(--color-text-secondary)]">
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>
      <div className="hidden gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 sm:flex">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              handleTabChange(tab.key);
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-text)]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* General settings tab */}
      {activeTab === "general" && (
        <>
          {/* Language settings */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
                <Languages className="h-5 w-5" />
                {t("admin_lang_title")}
              </h2>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                  {t("admin_lang_label")}
                </label>
                <select
                  value={settings.default_language ?? locale}
                  onChange={(e) => {
                    handleLanguageChange(e.target.value);
                  }}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                >
                  <option value="en">English</option>
                  <option value="ko">한국어</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Display settings */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
                <FileText className="h-5 w-5" />
                {t("admin_display_title")}
              </h2>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-[var(--color-text)]">
                      {t("admin_display_lazy_load")}
                    </label>
                  </div>
                  <ToggleSwitch
                    checked={settings.lazy_load_images === "true"}
                    onToggle={() => {
                      update(
                        "lazy_load_images",
                        settings.lazy_load_images === "true" ? "false" : "true",
                      );
                    }}
                    label={t("admin_display_lazy_load")}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    {t("admin_display_per_page")}
                  </label>
                  <select
                    value={settings.posts_per_page ?? "10"}
                    onChange={(e) => {
                      update("posts_per_page", e.target.value);
                    }}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                  >
                    {[3, 5, 10, 15, 20, 30].map((n) => (
                      <option key={n} value={String(n)}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    {t("admin_comment_per_page")}
                  </label>
                  <select
                    value={settings.comments_per_page ?? "50"}
                    onChange={(e) => {
                      update("comments_per_page", e.target.value);
                    }}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                  >
                    {[10, 20, 50, 100].map((n) => (
                      <option key={n} value={String(n)}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    {t("admin_comment_mode")}
                  </label>
                  <select
                    value={settings.comment_mode ?? "sso_only"}
                    onChange={(e) => {
                      update("comment_mode", e.target.value);
                    }}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                  >
                    <option value="sso_only">{t("admin_comment_mode_sso")}</option>
                    <option value="all">{t("admin_comment_mode_all")}</option>
                    <option value="anonymous_only">{t("admin_comment_mode_anon")}</option>
                    <option value="disabled">{t("admin_comment_mode_disabled")}</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
                <Activity className="h-5 w-5" />
                {t("admin_notifications")}
              </h2>
              <div className="flex flex-col gap-2">
                <label className="text-sm text-[var(--color-text-secondary)]">
                  {t("admin_slack_webhook_label")}
                </label>
                <div className="flex gap-2">
                  <Input
                    value={settings.notification_slack_webhook ?? ""}
                    onChange={(e) => {
                      update("notification_slack_webhook", e.target.value);
                    }}
                    placeholder="https://hooks.slack.com/services/..."
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void handleTestSlack();
                    }}
                    disabled={testingSlack || !settings.notification_slack_webhook}
                  >
                    {testingSlack ? t("loading") : t("admin_slack_test")}
                  </Button>
                </div>
                {slackTestResult === "ok" && (
                  <p className="text-sm text-[var(--color-success)]">{t("admin_slack_test_ok")}</p>
                )}
                {slackTestResult === "error" && (
                  <p className="text-sm text-[var(--color-destructive)]">
                    {t("admin_slack_test_error")}
                  </p>
                )}
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t("admin_slack_webhook_hint")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* SEO settings */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
                <Globe className="h-5 w-5" />
                {t("admin_seo_title")}
              </h2>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    {t("admin_seo_canonical_url")}
                  </label>
                  <Input
                    value={settings.canonical_url ?? ""}
                    onChange={(e) => {
                      update("canonical_url", e.target.value);
                    }}
                    placeholder="https://example.com"
                  />
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {t("admin_seo_canonical_url_help")}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    {t("admin_seo_meta_desc")}
                  </label>
                  <Textarea
                    value={desc}
                    onChange={(e) => {
                      update("seo_description", e.target.value);
                    }}
                    maxLength={160}
                    rows={3}
                  />
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {desc.length}/160
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] p-4">
                  <p className="mb-1 text-xs text-[var(--color-text-secondary)]">
                    {t("admin_seo_preview")}
                  </p>
                  <p className="text-lg text-blue-700">{title || t("admin_seo_preview_title")}</p>
                  <p className="text-sm text-green-700">
                    {settings.canonical_url ?? window.location.origin}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {desc || t("admin_seo_preview_desc")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Theme tab */}
      {activeTab === "theme" && <ThemeCustomizer settings={settings} update={update} />}

      {/* Content tab */}
      {activeTab === "content" && (
        <>
          <CategoryManager />
          <TemplateManager />
          <PostManager />
        </>
      )}

      {/* Federation tab */}
      {activeTab === "federation" && (
        <>
          {/* Federation settings */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
                <Globe className="h-5 w-5" />
                {t("admin_fed_title")}
              </h2>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    {t("admin_fed_site_url")}
                  </label>
                  <Input value={window.location.origin} disabled className="opacity-60" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    {t("admin_fed_sync_interval")}
                  </label>
                  <select
                    value={settings.webhook_sync_interval ?? "15"}
                    onChange={(e) => {
                      update("webhook_sync_interval", e.target.value);
                    }}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                  >
                    <option value="5">{t("admin_fed_5min")}</option>
                    <option value="15">{t("admin_fed_15min")}</option>
                    <option value="30">{t("admin_fed_30min")}</option>
                    <option value="60">{t("admin_fed_1hour")}</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Categories I'm subscribed to */}
          <SubscriptionManager subscribeAction={subscribeAction} />

          {/* Subscriber management */}
          <SubscriberManager />
        </>
      )}
    </div>
  );
}
