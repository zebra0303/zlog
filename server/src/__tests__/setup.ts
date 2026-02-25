import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";
import * as analyticsSchema from "../db/schema/analytics.js";
import { vi, beforeAll, afterAll } from "vitest";

// 1. Create in-memory SQLite for Main DB
const testSqlite = new Database(":memory:");
testSqlite.pragma("journal_mode = WAL");
testSqlite.pragma("foreign_keys = ON");
const testDb = drizzle(testSqlite, { schema });

// 2. Create in-memory SQLite for Analytics DB
const testAnalyticsSqlite = new Database(":memory:");
testAnalyticsSqlite.pragma("journal_mode = WAL");
const testAnalyticsDb = drizzle(testAnalyticsSqlite, { schema: analyticsSchema });

// 3. Mock DB module
vi.mock("../db/index.js", () => ({
  db: testDb,
  sqlite: testSqlite,
  analyticsDb: testAnalyticsDb,
  analyticsSqlite: testAnalyticsSqlite,
  initAnalyticsDb: () => {
    // In-memory setup handled in beforeAll below, but we can keep empty stub if needed
  },
}));

// 4. Mock background services
vi.mock("../services/syncService.js", () => ({
  startSyncWorker: vi.fn(),
  stopSyncWorker: vi.fn(),
  triggerStaleSync: vi.fn(),
  syncSubscription: vi.fn(),
  syncAllSubscriptions: vi.fn(),
}));

vi.mock("../services/feedService.js", () => ({
  sendWebhookToSubscribers: vi.fn(),
}));

// 5. Global fetch mock (prevent external requests like webhooks)
vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))),
);

// 6. Test environment variables
process.env.JWT_SECRET = "test-secret-key-for-testing";
process.env.SITE_URL = "http://localhost:3000";
process.env.ADMIN_EMAIL = "admin@test.com";
process.env.ADMIN_PASSWORD = "testpassword123";
process.env.ADMIN_DISPLAY_NAME = "Test Admin";
process.env.NODE_ENV = "test";

// 7. Create schema before tests
beforeAll(() => {
  // --- Main DB Schema ---
  testSqlite.exec(`
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

    CREATE TABLE IF NOT EXISTS post_likes (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      visitor_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(post_id, visitor_id)
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

    CREATE TABLE IF NOT EXISTS site_settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    
    -- FTS Table for search tests
    CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
      title,
      content='posts',
      content_rowid='rowid'
    );
  `);

  // --- Analytics DB Schema ---
  testAnalyticsSqlite.exec(`
    CREATE TABLE IF NOT EXISTS failed_logins (
      id TEXT PRIMARY KEY,
      ip_address TEXT NOT NULL,
      attempted_email TEXT,
      attempted_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_failed_logins_ip ON failed_logins(ip_address, attempted_at);

    CREATE TABLE IF NOT EXISTS post_access_logs (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL, -- No FK in analytics db to main db
      ip TEXT,
      country TEXT,
      referer TEXT,
      user_agent TEXT,
      os TEXT,
      browser TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_post_access_logs_post ON post_access_logs(post_id);

    CREATE TABLE IF NOT EXISTS visitor_logs (
      id TEXT PRIMARY KEY,
      ip TEXT,
      country TEXT,
      user_agent TEXT,
      os TEXT,
      browser TEXT,
      referer TEXT,
      visited_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_visitor_logs_date ON visitor_logs(visited_at);

    CREATE TABLE IF NOT EXISTS daily_visitor_counts (
      date TEXT PRIMARY KEY,
      count INTEGER DEFAULT 0 NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
});

afterAll(() => {
  testSqlite.close();
  testAnalyticsSqlite.close();
});
