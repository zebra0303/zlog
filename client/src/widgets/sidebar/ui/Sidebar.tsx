import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Folder, Rss } from "lucide-react";
import { Card, CardContent, DefaultAvatar, Badge } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n";
import type { CategoryWithStats, ProfileWithStats } from "@zlog/shared";

export function Sidebar() {
  const [profile, setProfile] = useState<ProfileWithStats | null>(null);
  const [categories, setCategories] = useState<CategoryWithStats[]>([]);
  const { t } = useI18n();

  useEffect(() => {
    void api.get<ProfileWithStats>("/profile").then(setProfile).catch(() => null);
    void api.get<CategoryWithStats[]>("/categories").then(setCategories).catch(() => []);
  }, []);

  return (
    <aside className="flex flex-col gap-4">
      {profile && (
        <Card><CardContent className="pt-6">
          <Link to="/profile" className="flex flex-col items-center gap-3">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt={profile.displayName} className="h-20 w-20 rounded-full object-cover" /> : <DefaultAvatar size={80} />}
            <div className="text-center">
              <h3 className="font-semibold text-[var(--color-text)]">{profile.displayName}</h3>
              {profile.bio && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{profile.bio}</p>}
            </div>
          </Link>
          <div className="mt-4 flex justify-around border-t border-[var(--color-border)] pt-4">
            <div className="flex flex-col items-center"><span className="text-lg font-bold text-[var(--color-text)]">{profile.stats.totalPosts}</span><span className="text-xs text-[var(--color-text-secondary)]">{t("sidebar_posts")}</span></div>
            <div className="flex flex-col items-center"><span className="text-lg font-bold text-[var(--color-text)]">{profile.stats.totalCategories}</span><span className="text-xs text-[var(--color-text-secondary)]">{t("sidebar_categories")}</span></div>
            <div className="flex flex-col items-center"><span className="text-lg font-bold text-[var(--color-text)]">{profile.stats.totalViews}</span><span className="text-xs text-[var(--color-text-secondary)]">{t("sidebar_views")}</span></div>
          </div>
          <div className="mt-3 flex justify-center border-t border-[var(--color-border)] pt-3">
            <a href="/rss.xml" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)]" title="RSS Feed">
              <Rss className="h-4 w-4" />
              <span>RSS</span>
            </a>
          </div>
        </CardContent></Card>
      )}
      {categories.length > 0 && (
        <Card><CardContent className="pt-6">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-[var(--color-text)]"><Folder className="h-4 w-4" />{t("sidebar_category_title")}</h3>
          <ul className="flex flex-col gap-1">
            {categories.map((cat) => (
              <li key={cat.id}><Link to={`/category/${cat.slug}`} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-background)]"><span>{cat.name}</span><Badge variant="secondary">{cat.postCount}</Badge></Link></li>
            ))}
          </ul>
        </CardContent></Card>
      )}
    </aside>
  );
}
