import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ============ owner — blog owner (single) ============
export const owner = sqliteTable("owner", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  blogHandle: text("blog_handle").notNull().unique(),
  siteUrl: text("site_url").notNull(),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  aboutMe: text("about_me"),
  jobTitle: text("job_title"),
  company: text("company"),
  location: text("location"),
  avatarUrl: text("avatar_url"),
  avatarOriginalName: text("avatar_original_name"),
  avatarMimeType: text("avatar_mime_type"),
  avatarSizeBytes: integer("avatar_size_bytes"),
  blogTitle: text("blog_title"),
  blogDescription: text("blog_description"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ============ socialLinks — social links ============
export const socialLinks = sqliteTable("social_links", {
  id: text("id").primaryKey(),
  platform: text("platform").notNull(),
  url: text("url").notNull(),
  label: text("label"),
  sortOrder: integer("sort_order").default(0).notNull(),
});
