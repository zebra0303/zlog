import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { categories } from "./posts.js";

// ============ remoteBlogs — remote blog cache ============
export const remoteBlogs = sqliteTable("remote_blogs", {
  id: text("id").primaryKey(),
  siteUrl: text("site_url").notNull().unique(),
  displayName: text("display_name"),
  blogTitle: text("blog_title"),
  avatarUrl: text("avatar_url"),
  lastFetchedAt: text("last_fetched_at"),
  createdAt: text("created_at").notNull(),
});

// ============ remoteCategories — remote category cache ============
export const remoteCategories = sqliteTable(
  "remote_categories",
  {
    id: text("id").primaryKey(),
    remoteBlogId: text("remote_blog_id")
      .notNull()
      .references(() => remoteBlogs.id, { onDelete: "cascade" }),
    remoteId: text("remote_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_remote_categories_blog").on(table.remoteBlogId)],
);

// ============ categorySubscriptions — subscription relations ============
export const categorySubscriptions = sqliteTable(
  "category_subscriptions",
  {
    id: text("id").primaryKey(),
    localCategoryId: text("local_category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    remoteCategoryId: text("remote_category_id")
      .notNull()
      .references(() => remoteCategories.id, { onDelete: "cascade" }),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    lastSyncedAt: text("last_synced_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("idx_cat_sub_unique").on(table.localCategoryId, table.remoteCategoryId)],
);

// ============ remotePosts — remote post cache ============
export const remotePosts = sqliteTable(
  "remote_posts",
  {
    id: text("id").primaryKey(),
    remoteUri: text("remote_uri").notNull().unique(),
    remoteBlogId: text("remote_blog_id")
      .notNull()
      .references(() => remoteBlogs.id, { onDelete: "cascade" }),
    remoteCategoryId: text("remote_category_id")
      .notNull()
      .references(() => remoteCategories.id, { onDelete: "cascade" }),
    localCategoryId: text("local_category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    content: text("content").notNull(),
    excerpt: text("excerpt"),
    coverImage: text("cover_image"),
    remoteStatus: text("remote_status", {
      enum: ["published", "draft", "deleted", "unreachable"],
    })
      .default("published")
      .notNull(),
    authorName: text("author_name"),
    remoteCreatedAt: text("remote_created_at").notNull(),
    remoteUpdatedAt: text("remote_updated_at").notNull(),
    fetchedAt: text("fetched_at").notNull(),
  },
  (table) => [
    index("idx_remote_posts_feed").on(
      table.remoteStatus,
      table.localCategoryId,
      table.remoteCreatedAt,
    ),
  ],
);

// ============ subscribers — external servers subscribing to this blog ============
export const subscribers = sqliteTable(
  "subscribers",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    subscriberUrl: text("subscriber_url").notNull(),
    callbackUrl: text("callback_url").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("idx_subscribers_unique").on(table.categoryId, table.subscriberUrl)],
);
