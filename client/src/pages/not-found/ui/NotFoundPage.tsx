import { Link } from "react-router";
import { Home } from "lucide-react";
import { Button, ZlogLogo, SEOHead } from "@/shared/ui";
import { useI18n } from "@/shared/i18n";

export default function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
      <SEOHead title={`404 - ${t("not_found_title")}`} />
      <ZlogLogo size={96} />
      <div className="text-center">
        <h1 className="text-6xl font-bold text-[var(--color-primary)]">404</h1>
        <p className="mt-2 text-xl text-[var(--color-text)]">{t("not_found_title")}</p>
        <p className="mt-1 text-[var(--color-text-secondary)]">{t("not_found_description")}</p>
      </div>
      <Button asChild><Link to="/"><Home className="mr-2 h-4 w-4" />{t("not_found_go_home")}</Link></Button>
    </div>
  );
}
