import Database, { type Database as DatabaseType } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import * as analyticsSchema from "./schema/analytics.js";
import path from "path";
import { mkdirSync } from "fs";

// Main Database (zlog.db)
const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "zlog.db");
mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite: DatabaseType = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };

// Analytics Database (analytics.db)
const ANALYTICS_DB_PATH =
  process.env.ANALYTICS_DB_PATH ?? path.join(process.cwd(), "data", "analytics.db");
mkdirSync(path.dirname(ANALYTICS_DB_PATH), { recursive: true });

const analyticsSqlite: DatabaseType = new Database(ANALYTICS_DB_PATH);
analyticsSqlite.pragma("journal_mode = WAL");

export const analyticsDb = drizzle(analyticsSqlite, { schema: analyticsSchema });
export { analyticsSqlite };

export function initAnalyticsDb() {
  analyticsSqlite.exec(`
    CREATE TABLE IF NOT EXISTS failed_logins (
      id TEXT PRIMARY KEY,
      ip_address TEXT NOT NULL,
      attempted_email TEXT,
      attempted_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_failed_logins_ip ON failed_logins (ip_address, attempted_at);
    CREATE INDEX IF NOT EXISTS idx_failed_logins_attempted ON failed_logins (attempted_at);

    CREATE TABLE IF NOT EXISTS post_access_logs (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      ip TEXT,
      country TEXT,
      referer TEXT,
      user_agent TEXT,
      os TEXT,
      browser TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_post_access_logs_post ON post_access_logs (post_id);

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
    CREATE INDEX IF NOT EXISTS idx_visitor_logs_date ON visitor_logs (visited_at);

    CREATE TABLE IF NOT EXISTS daily_visitor_counts (
      date TEXT PRIMARY KEY,
      count INTEGER DEFAULT 0 NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}
