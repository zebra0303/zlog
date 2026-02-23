import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// ============ siteSettings — site settings (key-value) ============
export const siteSettings = sqliteTable("site_settings", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});
