import { useNavigate } from "react-router";
import { useI18n } from "@/shared/i18n";
import { Button, ZlogLogo, SEOHead } from "@/shared/ui";
import { ArrowLeft } from "lucide-react";

export function OfflineFallback() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-4">
      <SEOHead title={t("offline_title")} />

      <div className="relative mb-4 h-48 w-48 drop-shadow-lg md:h-64 md:w-64">
        <img
          src="/images/offline.webp"
          alt="Offline Astronaut"
          className="h-full w-full rounded-2xl object-contain"
        />
        <div className="absolute -right-4 -bottom-4 rounded-full bg-[var(--color-surface)] p-2 shadow-md">
          <ZlogLogo size={32} />
        </div>
      </div>

      <div className="max-w-sm text-center">
        <h1 className="mb-2 text-2xl font-bold text-[var(--color-text)]">{t("offline_title")}</h1>
        <p className="text-[var(--color-text-secondary)]">{t("offline_message")}</p>
      </div>

      <Button onClick={() => navigate(-1)} className="mt-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("offline_go_back")}
      </Button>
    </div>
  );
}
