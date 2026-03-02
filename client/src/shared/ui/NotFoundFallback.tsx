import { useNavigate } from "react-router";
import { useI18n } from "@/shared/i18n";
import { Button, ZlogLogo, SEOHead } from "@/shared/ui";
import { ArrowLeft } from "lucide-react";

interface Props {
  title?: string;
  message?: string;
}

export function NotFoundFallback({ title, message }: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-4">
      <SEOHead title={title ?? t("not_found_title")} />

      <div className="relative mb-4 h-48 w-48 drop-shadow-lg md:h-64 md:w-64">
        <img
          src="/images/notfound.webp"
          alt="404 Astronaut Zebra"
          className="h-full w-full rounded-2xl object-contain drop-shadow-md"
        />
        <div className="absolute -right-4 -bottom-4 rounded-full bg-[var(--color-surface)] p-2 shadow-md">
          <ZlogLogo size={32} />
        </div>
      </div>

      <div className="max-w-sm text-center">
        <h1 className="mb-2 text-2xl font-bold text-[var(--color-text)]">
          {title ?? t("not_found_title")}
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          {message ?? t("not_found_description")}
        </p>
      </div>

      <Button onClick={() => navigate(-1)} className="mt-2 fill-white stroke-white text-white">
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("not_found_go_back")}
      </Button>
    </div>
  );
}
