import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

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
    index("idx_posts_status_created").on(table.status, table.createdAt),
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

// ============ comments — post comments ============
export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    commenterId: text("commenter_id").references(() => commenters.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    authorEmail: text("author_email").notNull(),
    authorUrl: text("author_url"),
    authorAvatarUrl: text("author_avatar_url"),
    content: text("content").notNull(),
    password: text("password"),
    parentId: text("parent_id"),
    isEdited: integer("is_edited", { mode: "boolean" }).default(false).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [index("idx_comments_post").on(table.postId)],
);

// ============ commentLikes — comment likes ============
export const commentLikes = sqliteTable(
  "comment_likes",
  {
    id: text("id").primaryKey(),
    commentId: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_comment_likes_unique").on(table.commentId, table.visitorId),
    index("idx_comment_likes_comment").on(table.commentId),
  ],
);

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

// ============ commenters — OAuth comment authors ============
export const commenters = sqliteTable(
  "commenters",
  {
    id: text("id").primaryKey(),
    provider: text("provider", { enum: ["github", "google"] }).notNull(),
    providerId: text("provider_id").notNull(),
    displayName: text("display_name").notNull(),
    email: text("email"),
    avatarUrl: text("avatar_url"),
    profileUrl: text("profile_url"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("idx_commenters_provider").on(table.provider, table.providerId)],
);

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

// ============ siteSettings — site settings (key-value) ============
export const siteSettings = sqliteTable("site_settings", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});
