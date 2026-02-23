import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// ============ categories — post categories ============
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  longDescription: text("long_description"),
  coverImage: text("cover_image"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isPublic: integer("is_public", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ============ posts — blog posts ============
export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    content: text("content").notNull(),
    excerpt: text("excerpt"),
    coverImage: text("cover_image"),
    status: text("status", { enum: ["draft", "published", "deleted"] })
      .default("draft")
      .notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("idx_posts_status").on(table.status),
    index("idx_posts_category").on(table.categoryId),
    index("idx_posts_created").on(table.createdAt),
    // Composite index for common feed queries: "published" posts sorted by date
    index("idx_posts_status_created").on(table.status, table.createdAt),
    // Composite index for category feed: category + status + date
    index("idx_posts_cat_status_created").on(table.categoryId, table.status, table.createdAt),
  ],
);

// ============ tags + postTags ============
export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const postTags = sqliteTable(
  "post_tags",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("idx_post_tags_unique").on(table.postId, table.tagId),
    index("idx_post_tags_tag").on(table.tagId),
  ],
);
