import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { posts } from "./posts.js";

// ============ failedLogins — brute-force protection ============
export const failedLogins = sqliteTable(
  "failed_logins",
  {
    id: text("id").primaryKey(),
    ipAddress: text("ip_address").notNull(),
    attemptedEmail: text("attempted_email"),
    attemptedAt: text("attempted_at").notNull(),
  },
  (table) => [
    index("idx_failed_logins_ip").on(table.ipAddress, table.attemptedAt),
    index("idx_failed_logins_attempted").on(table.attemptedAt),
  ],
);

// ============ postAccessLogs — visitor access logs per post ============
export const postAccessLogs = sqliteTable(
  "post_access_logs",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    ip: text("ip"),
    country: text("country"),
    referer: text("referer"),
    userAgent: text("user_agent"),
    os: text("os"),
    browser: text("browser"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_post_access_logs_post").on(table.postId)],
);

// ============ visitorLogs — detailed recent visitors (max 20 per day) ============
export const visitorLogs = sqliteTable(
  "visitor_logs",
  {
    id: text("id").primaryKey(),
    ip: text("ip"),
    country: text("country"),
    userAgent: text("user_agent"),
    os: text("os"),
    browser: text("browser"),
    referer: text("referer"),
    visitedAt: text("visited_at").notNull(),
  },
  (table) => [index("idx_visitor_logs_date").on(table.visitedAt)],
);

// ============ dailyVisitorCounts — simple counter per day ============
export const dailyVisitorCounts = sqliteTable("daily_visitor_counts", {
  date: text("date").primaryKey(), // YYYY-MM-DD
  count: integer("count").default(0).notNull(),
  updatedAt: text("updated_at").notNull(),
});
