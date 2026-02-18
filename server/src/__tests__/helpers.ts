import { db, sqlite } from "../db/index.js";
import * as schema from "../db/schema.js";
import { generateId } from "../lib/uuid.js";
import { hashPassword } from "../lib/password.js";
import { createToken } from "../middleware/auth.js";
import { eq } from "drizzle-orm";

export interface TestAdmin {
  id: string;
  email: string;
  password: string;
}

export function seedTestAdmin(): TestAdmin {
  const id = generateId();
  const email = "admin@test.com";
  const password = "testpassword123";
  const now = new Date().toISOString();

  db.insert(schema.owner)
    .values({
      id,
      email,
      passwordHash: hashPassword(password),
      blogHandle: "testadmin",
      siteUrl: "http://localhost:3000",
      displayName: "Test Admin",
      blogTitle: "Test Blog",
      blogDescription: "A test blog description",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, email, password };
}

export function seedDefaultSettings(): void {
  const now = new Date().toISOString();
  const defaults: Record<string, string> = {
    posts_per_page: "10",
    blog_title: "Test Blog",
    seo_description: "Test blog description",
    seo_og_image: "",
    canonical_url: "http://localhost:3000",
    comment_mode: "both",
    webhook_sync_interval: "15",
    default_theme: "system",
  };

  for (const [key, value] of Object.entries(defaults)) {
    db.insert(schema.siteSettings).values({ id: generateId(), key, value, updatedAt: now }).run();
  }
}

export async function getAuthToken(ownerId: string): Promise<string> {
  return createToken(ownerId);
}

export function createTestCategory(overrides?: Partial<typeof schema.categories.$inferInsert>) {
  const id = generateId();
  const now = new Date().toISOString();
  const name = overrides?.name ?? "Test Category";
  const { id: _ignoreId, ...safeOverrides } = overrides ?? {};
  db.insert(schema.categories)
    .values({
      id,
      name,
      slug: overrides?.slug ?? `test-category-${id.slice(0, 8)}`,
      sortOrder: 0,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
      ...safeOverrides,
    })
    .run();
  const result = db.select().from(schema.categories).where(eq(schema.categories.id, id)).get();
  if (!result) throw new Error(`Failed to create test category with id ${id}`);
  return result;
}

export function createTestPost(overrides?: Partial<typeof schema.posts.$inferInsert>) {
  const id = generateId();
  const now = new Date().toISOString();
  const { id: _ignoreId2, ...safePostOverrides } = overrides ?? {};
  db.insert(schema.posts)
    .values({
      id,
      title: "Test Post",
      slug: overrides?.slug ?? `test-post-${id.slice(0, 8)}`,
      content: "Test content for the post.",
      status: "published",
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
      ...safePostOverrides,
    })
    .run();
  const result = db.select().from(schema.posts).where(eq(schema.posts.id, id)).get();
  if (!result) throw new Error(`Failed to create test post with id ${id}`);
  return result;
}

export function createTestComment(
  postId: string,
  overrides?: Partial<typeof schema.comments.$inferInsert>,
) {
  const id = generateId();
  const now = new Date().toISOString();
  const { id: _ignoreId3, postId: _ignorePostId, ...safeCommentOverrides } = overrides ?? {};
  db.insert(schema.comments)
    .values({
      id,
      postId,
      authorName: "Test Commenter",
      authorEmail: "commenter@test.com",
      content: "Test comment content",
      password: hashPassword("commentpass"),
      createdAt: now,
      updatedAt: now,
      ...safeCommentOverrides,
    })
    .run();
  const result = db.select().from(schema.comments).where(eq(schema.comments.id, id)).get();
  if (!result) throw new Error(`Failed to create test comment with id ${id}`);
  return result;
}

export function createTestRemoteBlog(overrides?: Partial<typeof schema.remoteBlogs.$inferInsert>) {
  const id = generateId();
  const now = new Date().toISOString();
  const { id: _ignoreId4, ...safeOverrides } = overrides ?? {};
  db.insert(schema.remoteBlogs)
    .values({
      id,
      siteUrl: overrides?.siteUrl ?? `https://remote-${id.slice(0, 8)}.example.com`,
      displayName: "Remote Blog",
      blogTitle: "Remote Blog Title",
      createdAt: now,
      ...safeOverrides,
    })
    .run();
  const result = db.select().from(schema.remoteBlogs).where(eq(schema.remoteBlogs.id, id)).get();
  if (!result) throw new Error(`Failed to create test remote blog with id ${id}`);
  return result;
}

export function createTestRemotePost(
  remoteBlogId: string,
  localCategoryId: string,
  overrides?: Partial<typeof schema.remotePosts.$inferInsert>,
) {
  const id = generateId();
  const now = new Date().toISOString();
  // remote_category_id is required by schema, so we create one if not provided
  let remoteCategoryId = overrides?.remoteCategoryId;
  if (!remoteCategoryId) {
    const rcId = generateId();
    db.insert(schema.remoteCategories)
      .values({
        id: rcId,
        remoteBlogId,
        remoteId: "remote-cat-1",
        name: "Remote Category",
        slug: "remote-category",
        createdAt: now,
      })
      .run();
    remoteCategoryId = rcId;
  }
  const {
    id: _ignoreId5,
    remoteBlogId: _rb,
    remoteCategoryId: _rc,
    ...safeOverrides
  } = overrides ?? {};
  db.insert(schema.remotePosts)
    .values({
      id,
      remoteUri: overrides?.remoteUri ?? `https://remote.example.com/posts/${id}`,
      remoteBlogId,
      remoteCategoryId,
      localCategoryId,
      title: "Remote Post",
      slug: `remote-post-${id.slice(0, 8)}`,
      content: "Remote content",
      remoteStatus: "published",
      remoteCreatedAt: now,
      remoteUpdatedAt: now,
      fetchedAt: now,
      ...safeOverrides,
    })
    .run();
  const result = db.select().from(schema.remotePosts).where(eq(schema.remotePosts.id, id)).get();
  if (!result) throw new Error(`Failed to create test remote post with id ${id}`);
  return result;
}

export function cleanDb(): void {
  sqlite.exec(`
    DELETE FROM failed_logins;
    DELETE FROM comment_likes;
    DELETE FROM comments;
    DELETE FROM post_tags;
    DELETE FROM tags;
    DELETE FROM posts;
    DELETE FROM categories;
    DELETE FROM social_links;
    DELETE FROM site_settings;
    DELETE FROM subscribers;
    DELETE FROM remote_posts;
    DELETE FROM category_subscriptions;
    DELETE FROM remote_categories;
    DELETE FROM remote_blogs;
    DELETE FROM commenters;
    DELETE FROM owner;
  `);
}
