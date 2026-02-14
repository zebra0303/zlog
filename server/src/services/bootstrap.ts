import { db, sqlite } from "../db/index.js";
import * as schema from "../db/schema.js";
import { generateId } from "../lib/uuid.js";
import { hashPassword } from "../lib/password.js";
import { eq } from "drizzle-orm";

/**
 * 첫 실행 시 테이블 생성 + 관리자 계정 + 기본 설정
 */
export function bootstrap() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS owner (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      blog_handle TEXT UNIQUE NOT NULL,
      site_url TEXT NOT NULL,
      display_name TEXT NOT NULL,
      bio TEXT,
      about_me TEXT,
      job_title TEXT,
      company TEXT,
      location TEXT,
      avatar_url TEXT,
      avatar_original_name TEXT,
      avatar_mime_type TEXT,
      avatar_size_bytes INTEGER,
      blog_title TEXT,
      blog_description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS social_links (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      url TEXT NOT NULL,
      label TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      long_description TEXT,
      cover_image TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_public INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      excerpt TEXT,
      cover_image TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
    CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id);
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS post_tags (
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      UNIQUE(post_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      commenter_id TEXT REFERENCES commenters(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL,
      author_url TEXT,
      author_avatar_url TEXT,
      content TEXT NOT NULL,
      password TEXT,
      parent_id TEXT,
      is_edited INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);

    CREATE TABLE IF NOT EXISTS comment_likes (
      id TEXT PRIMARY KEY,
      comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      visitor_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(comment_id, visitor_id)
    );

    CREATE TABLE IF NOT EXISTS remote_blogs (
      id TEXT PRIMARY KEY,
      site_url TEXT UNIQUE NOT NULL,
      display_name TEXT,
      blog_title TEXT,
      avatar_url TEXT,
      last_fetched_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS remote_categories (
      id TEXT PRIMARY KEY,
      remote_blog_id TEXT NOT NULL REFERENCES remote_blogs(id) ON DELETE CASCADE,
      remote_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS category_subscriptions (
      id TEXT PRIMARY KEY,
      local_category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      remote_category_id TEXT NOT NULL REFERENCES remote_categories(id) ON DELETE CASCADE,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_synced_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(local_category_id, remote_category_id)
    );

    CREATE TABLE IF NOT EXISTS remote_posts (
      id TEXT PRIMARY KEY,
      remote_uri TEXT UNIQUE NOT NULL,
      remote_blog_id TEXT NOT NULL REFERENCES remote_blogs(id) ON DELETE CASCADE,
      remote_category_id TEXT NOT NULL REFERENCES remote_categories(id) ON DELETE CASCADE,
      local_category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      content TEXT NOT NULL,
      excerpt TEXT,
      cover_image TEXT,
      remote_status TEXT NOT NULL DEFAULT 'published',
      author_name TEXT,
      remote_created_at TEXT NOT NULL,
      remote_updated_at TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscribers (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      subscriber_url TEXT NOT NULL,
      callback_url TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE(category_id, subscriber_url)
    );

    CREATE TABLE IF NOT EXISTS commenters (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT,
      avatar_url TEXT,
      profile_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(provider, provider_id)
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // comments 테이블에 commenter_id 컬럼 추가 (마이그레이션)
  try {
    sqlite.exec(
      "ALTER TABLE comments ADD COLUMN commenter_id TEXT REFERENCES commenters(id) ON DELETE SET NULL",
    );
  } catch {
    // 이미 존재하면 무시
  }

  // comments 테이블에 password 컬럼 추가 (마이그레이션)
  try {
    sqlite.exec("ALTER TABLE comments ADD COLUMN password TEXT");
  } catch {
    // 이미 존재하면 무시
  }

  // 관리자 계정이 없으면 생성
  const existingOwner = db.select().from(schema.owner).limit(1).all();
  if (existingOwner.length === 0) {
    const now = new Date().toISOString();
    const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
    const password = process.env.ADMIN_PASSWORD ?? "changeme";
    const displayName = process.env.ADMIN_DISPLAY_NAME ?? "Blog Owner";
    const blogHandle = process.env.ADMIN_BLOG_HANDLE ?? "admin";
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

    db.insert(schema.owner)
      .values({
        id: generateId(),
        email,
        passwordHash: hashPassword(password),
        blogHandle,
        siteUrl,
        displayName,
        blogTitle: `${displayName}'s Blog`,
        blogDescription: "zlog로 만든 개인 블로그입니다.",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    console.log(`✅ 관리자 계정 생성됨: ${email}`);
  }

  // 기본 사이트 설정
  const defaultSettings: Record<string, string> = {
    posts_per_page: "10",
    lazy_load_images: "true",
    blog_title: process.env.ADMIN_DISPLAY_NAME
      ? `${process.env.ADMIN_DISPLAY_NAME}'s Blog`
      : "My zlog Blog",
    seo_description: "zlog로 만든 개인 블로그입니다.",
    seo_og_image: "",
    webhook_sync_interval: process.env.WEBHOOK_SYNC_INTERVAL ?? "15",
    default_theme: "system",
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    const existing = db
      .select()
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.key, key))
      .all();
    if (existing.length === 0) {
      db.insert(schema.siteSettings)
        .values({
          id: generateId(),
          key,
          value,
          updatedAt: new Date().toISOString(),
        })
        .run();
    }
  }

  console.log("✅ 데이터베이스 부트스트랩 완료");
}
