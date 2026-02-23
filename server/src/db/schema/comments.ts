import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { posts } from "./posts.js";

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
