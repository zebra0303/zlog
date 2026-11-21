import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { useI18n } from "@/shared/i18n";

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const { t } = useI18n();

  useEffect(() => {
    const commenterId = searchParams.get("commenterId");
    const displayName = searchParams.get("displayName");
    const avatarUrl = searchParams.get("avatarUrl");
    const provider = searchParams.get("provider");

    if (commenterId && displayName) {
      localStorage.setItem(
        "zlog_commenter",
        JSON.stringify({
          commenterId,
          displayName,
          avatarUrl: avatarUrl ?? "",
          provider: provider ?? "",
        }),
      );
      localStorage.setItem("zlog_oauth_just_logged_in", "1");
    }

    const returnUrl = localStorage.getItem("zlog_oauth_return") ?? "/";
    localStorage.removeItem("zlog_oauth_return");
    // Prevent open redirect: accept safe relative paths or same-origin URLs
    let safeReturn = "/";
    if (returnUrl.startsWith("/") && !returnUrl.startsWith("//")) {
      safeReturn = returnUrl;
    } else {
      try {
        const parsed = new URL(returnUrl);
        if (parsed.origin === window.location.origin) {
          safeReturn = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
      } catch {
        safeReturn = "/";
      }
    }
    window.location.href = safeReturn;
  }, [searchParams]);

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <p className="text-[var(--color-text-secondary)]">{t("comment_oauth_processing")}</p>
    </div>
  );
}
