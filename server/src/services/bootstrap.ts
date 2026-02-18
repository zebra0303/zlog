import { db, sqlite } from "../db/index.js";
import * as schema from "../db/schema.js";
import { generateId } from "../lib/uuid.js";
import { hashPassword } from "../lib/password.js";
import { eq } from "drizzle-orm";

/**
 * On first run: create tables + admin account + default settings
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
    CREATE INDEX IF NOT EXISTS idx_posts_status_created ON posts(status, created_at);

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
    CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);

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
    CREATE INDEX IF NOT EXISTS idx_remote_posts_feed ON remote_posts(remote_status, local_category_id, remote_created_at);

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

    CREATE TABLE IF NOT EXISTS failed_logins (
      id TEXT PRIMARY KEY,
      ip_address TEXT NOT NULL,
      attempted_email TEXT,
      attempted_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_failed_logins_ip ON failed_logins(ip_address, attempted_at);

    CREATE TABLE IF NOT EXISTS site_settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // ============ New indexes (migration) ============
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_failed_logins_attempted ON failed_logins(attempted_at);
    CREATE INDEX IF NOT EXISTS idx_remote_categories_blog ON remote_categories(remote_blog_id);
    CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
  `);

  // ============ FTS5 full-text search on posts ============
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
      title,
      content='posts',
      content_rowid='rowid'
    );
  `);

  // Rebuild FTS index on every startup to ensure consistency
  // (handles upgrades where FTS table is newly created against an existing DB)
  sqlite.exec("INSERT INTO posts_fts(posts_fts) VALUES('rebuild')");

  // Triggers to keep FTS in sync with posts table
  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS posts_fts_insert AFTER INSERT ON posts BEGIN
      INSERT INTO posts_fts(rowid, title) VALUES (NEW.rowid, NEW.title);
    END;
    CREATE TRIGGER IF NOT EXISTS posts_fts_update AFTER UPDATE OF title ON posts BEGIN
      UPDATE posts_fts SET title = NEW.title WHERE rowid = NEW.rowid;
    END;
    CREATE TRIGGER IF NOT EXISTS posts_fts_delete AFTER DELETE ON posts BEGIN
      INSERT INTO posts_fts(posts_fts, rowid, title) VALUES('delete', OLD.rowid, OLD.title);
    END;
  `);

  // Add commenter_id column to comments table (migration)
  try {
    sqlite.exec(
      "ALTER TABLE comments ADD COLUMN commenter_id TEXT REFERENCES commenters(id) ON DELETE SET NULL",
    );
  } catch {
    // Ignore if already exists
  }

  // Add password column to comments table (migration)
  try {
    sqlite.exec("ALTER TABLE comments ADD COLUMN password TEXT");
  } catch {
    // Ignore if already exists
  }

  // Create admin account if none exists
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
        blogDescription: "A personal blog powered by zlog.",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    console.log(`✅ Admin account created: ${email}`);
  }

  // Default site settings
  const defaultSettings: Record<string, string> = {
    posts_per_page: "10",
    lazy_load_images: "true",
    blog_title: process.env.ADMIN_DISPLAY_NAME
      ? `${process.env.ADMIN_DISPLAY_NAME}'s Blog`
      : "My zlog Blog",
    seo_description: "A personal blog powered by zlog.",
    seo_og_image: "",
    canonical_url: process.env.SITE_URL ?? "http://localhost:3000",
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

  console.log("✅ Database bootstrap complete");
}
