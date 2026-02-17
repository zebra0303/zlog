import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// ============ owner — 블로그 소유자 (1명) ============
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

// ============ socialLinks — 소셜 링크 ============
export const socialLinks = sqliteTable("social_links", {
  id: text("id").primaryKey(),
  platform: text("platform").notNull(),
  url: text("url").notNull(),
  label: text("label"),
  sortOrder: integer("sort_order").default(0).notNull(),
});

// ============ categories — 카테고리 ============
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

// ============ posts — 게시글 ============
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

// ============ comments — 댓글 ============
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

// ============ commentLikes — 댓글 좋아요 ============
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
  (table) => [uniqueIndex("idx_comment_likes_unique").on(table.commentId, table.visitorId)],
);

// ============ remoteBlogs — 외부 블로그 캐시 ============
export const remoteBlogs = sqliteTable("remote_blogs", {
  id: text("id").primaryKey(),
  siteUrl: text("site_url").notNull().unique(),
  displayName: text("display_name"),
  blogTitle: text("blog_title"),
  avatarUrl: text("avatar_url"),
  lastFetchedAt: text("last_fetched_at"),
  createdAt: text("created_at").notNull(),
});

// ============ remoteCategories — 외부 카테고리 캐시 ============
export const remoteCategories = sqliteTable("remote_categories", {
  id: text("id").primaryKey(),
  remoteBlogId: text("remote_blog_id")
    .notNull()
    .references(() => remoteBlogs.id, { onDelete: "cascade" }),
  remoteId: text("remote_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  createdAt: text("created_at").notNull(),
});

// ============ categorySubscriptions — 구독 관계 ============
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

// ============ remotePosts — 외부 글 캐시 ============
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

// ============ subscribers — 다른 서버가 나를 구독 ============
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

// ============ commenters — OAuth 댓글 작성자 ============
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

// ============ siteSettings — 사이트 설정 (key-value) ============
export const siteSettings = sqliteTable("site_settings", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});
