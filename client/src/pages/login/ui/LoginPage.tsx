import { useState } from "react";
import { useSearchParams } from "react-router";
import { LogIn } from "lucide-react";
import { Button, Input, Card, CardContent, CardHeader, SEOHead, ZlogLogo } from "@/shared/ui";
import { useAuthStore } from "@/features/auth/model/store";
import { useI18n } from "@/shared/i18n";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(email, password);
      const redirect = searchParams.get("redirect");
      // Force a full page reload so caches (categories, posts) are refreshed
      window.location.href = redirect ?? "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : t("request_failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <SEOHead title={t("login_title")} />
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex flex-col items-center gap-3">
            <ZlogLogo size={64} />
            <h1 className="text-2xl font-bold text-[var(--color-text)]">{t("login_title")}</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">{t("login_description")}</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                {t("login_email_placeholder")}
              </label>
              <Input
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                {t("login_password_placeholder")}
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                required
              />
            </div>
            {error && (
              <div className="rounded-lg bg-[var(--color-destructive-light)] p-3 text-sm text-[var(--color-destructive)]">
                {error}
              </div>
            )}
            <Button type="submit" disabled={isLoading} className="w-full">
              <LogIn className="mr-2 h-4 w-4" />
              {isLoading ? t("login_logging_in") : t("login_submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
