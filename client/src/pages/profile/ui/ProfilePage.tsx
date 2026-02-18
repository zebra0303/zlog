import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  MapPin,
  Briefcase,
  Building2,
  Globe,
  Mail,
  MessageCircle,
  Cloud,
  AtSign,
  Rss,
  Link as LinkIcon,
  Settings,
} from "lucide-react";
import { Card, CardContent, Button, DefaultAvatar, SEOHead, Skeleton } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useAuthStore } from "@/features/auth/model/store";
import { parseMarkdown } from "@/shared/lib/markdown/parser";
import { useI18n } from "@/shared/i18n";
import type { ProfileWithStats } from "@zlog/shared";

const ICONS: Record<string, React.ReactNode> = {
  github: <LinkIcon className="h-5 w-5" />,
  twitter: <LinkIcon className="h-5 w-5" />,
  instagram: <LinkIcon className="h-5 w-5" />,
  linkedin: <LinkIcon className="h-5 w-5" />,
  youtube: <LinkIcon className="h-5 w-5" />,
  facebook: <LinkIcon className="h-5 w-5" />,
  threads: <AtSign className="h-5 w-5" />,
  mastodon: <MessageCircle className="h-5 w-5" />,
  bluesky: <Cloud className="h-5 w-5" />,
  website: <Globe className="h-5 w-5" />,
  email: <Mail className="h-5 w-5" />,
  rss: <Rss className="h-5 w-5" />,
  custom: <LinkIcon className="h-5 w-5" />,
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileWithStats | null>(null);
  const [aboutHtml, setAboutHtml] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuthStore();
  const { t } = useI18n();
  useEffect(() => {
    void api
      .get<ProfileWithStats>("/profile")
      .then(async (d) => {
        setProfile(d);
        if (d.aboutMe) setAboutHtml(await parseMarkdown(d.aboutMe));
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);
  if (isLoading)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  if (!profile)
    return (
      <p className="text-center text-[var(--color-text-secondary)]">{t("profile_not_found")}</p>
    );
  return (
    <div className="flex min-w-0 flex-col gap-6 overflow-x-hidden">
      <SEOHead title={profile.displayName} description={profile.bio ?? undefined} />
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <DefaultAvatar size={96} />
            )}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-[var(--color-text)]">{profile.displayName}</h1>
              {profile.bio && (
                <p className="mt-1 text-[var(--color-text-secondary)]">{profile.bio}</p>
              )}
              <div className="mt-3 flex flex-wrap justify-center gap-3 sm:justify-start">
                {profile.jobTitle && (
                  <span className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)]">
                    <Briefcase className="h-4 w-4" />
                    {profile.jobTitle}
                  </span>
                )}
                {profile.company && (
                  <span className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)]">
                    <Building2 className="h-4 w-4" />
                    {profile.company}
                  </span>
                )}
                {profile.location && (
                  <span className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)]">
                    <MapPin className="h-4 w-4" />
                    {profile.location}
                  </span>
                )}
              </div>
              <div className="mt-4 flex justify-center gap-6 sm:justify-start">
                <div className="text-center">
                  <span className="text-xl font-bold text-[var(--color-text)]">
                    {profile.stats.totalPosts}
                  </span>
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("profile_posts")}</p>
                </div>
                <div className="text-center">
                  <span className="text-xl font-bold text-[var(--color-text)]">
                    {profile.stats.totalCategories}
                  </span>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("profile_categories")}
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-xl font-bold text-[var(--color-text)]">
                    {profile.stats.totalViews}
                  </span>
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("profile_views")}</p>
                </div>
              </div>
            </div>
            {isAuthenticated && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/settings">
                  <Settings className="mr-1 h-4 w-4" />
                  {t("profile_edit")}
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      {profile.socialLinks.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-3 font-semibold text-[var(--color-text)]">
              {t("profile_social_links")}
            </h2>
            <div className="flex flex-wrap gap-3">
              {profile.socialLinks.map((l) => (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${l.label ?? l.platform} (opens in new tab)`}
                  className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                >
                  {ICONS[l.platform] ?? <LinkIcon className="h-5 w-5" />}
                  {l.label ?? l.platform}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {aboutHtml && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-3 font-semibold text-[var(--color-text)]">{t("profile_about")}</h2>
            <div
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: aboutHtml }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
