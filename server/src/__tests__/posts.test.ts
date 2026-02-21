import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createApp } from "../app.js";
import {
  seedTestAdmin,
  seedDefaultSettings,
  getAuthToken,
  createTestCategory,
  createTestPost,
  createTestRemoteBlog,
  createTestRemotePost,
  cleanDb,
  type TestAdmin,
} from "./helpers.js";
import { db, sqlite } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";

describe("Posts API", () => {
  const app = createApp();
  let admin: TestAdmin;
  let token: string;

  beforeAll(async () => {
    cleanDb();
    admin = seedTestAdmin();
    seedDefaultSettings();
    token = await getAuthToken(admin.id);
  });

  beforeEach(() => {
    sqlite.exec(
      "DELETE FROM remote_posts; DELETE FROM category_subscriptions; DELETE FROM remote_categories; DELETE FROM remote_blogs; DELETE FROM post_tags; DELETE FROM tags; DELETE FROM posts; DELETE FROM categories;",
    );
  });

  describe("GET /api/posts", () => {
    it("should return empty list when no posts", async () => {
      const res = await app.request("/api/posts");
      expect(res.status).toBe(200);
      const data = (await res.json()) as { items: unknown[]; total: number };
      expect(data.items).toEqual([]);
      expect(data.total).toBe(0);
    });

    it("should return only published posts by default", async () => {
      createTestPost({ title: "Published", status: "published" });
      createTestPost({ title: "Draft", slug: "draft-post", status: "draft" });

      const res = await app.request("/api/posts");
      const data = (await res.json()) as { items: { title: string }[]; total: number };
      expect(data.total).toBe(1);
      expect(data.items[0]?.title).toBe("Published");
    });

    it("should filter by category", async () => {
      const cat = createTestCategory({ name: "Tech", slug: "tech" });
      createTestPost({ title: "Tech Post", categoryId: cat.id });
      createTestPost({ title: "No Category", slug: "no-category" });

      const res = await app.request("/api/posts?category=tech");
      const data = (await res.json()) as { items: { title: string }[] };
      expect(data.items).toHaveLength(1);
      expect(data.items[0]?.title).toBe("Tech Post");
    });

    it("should filter by search", async () => {
      createTestPost({ title: "React Tutorial" });
      createTestPost({ title: "Vue Guide", slug: "vue-guide" });

      const res = await app.request("/api/posts?search=React");
      const data = (await res.json()) as { items: { title: string }[] };
      expect(data.items).toHaveLength(1);
      expect(data.items[0]?.title).toBe("React Tutorial");
    });

    it("should filter by tag", async () => {
      const post1 = createTestPost({ title: "JS Post", slug: "js-post" });
      createTestPost({ title: "Other Post", slug: "other-post" });

      // Create tag and associate with post1
      const tagId = "tag-js-id";
      db.insert(schema.tags).values({ id: tagId, name: "javascript", slug: "javascript" }).run();
      db.insert(schema.postTags).values({ postId: post1.id, tagId }).run();

      const res = await app.request("/api/posts?tag=javascript");
      const data = (await res.json()) as { items: { title: string }[] };
      expect(data.items).toHaveLength(1);
      expect(data.items[0]?.title).toBe("JS Post");
    });

    it("should return empty list for non-existent tag", async () => {
      createTestPost({ title: "Some Post" });

      const res = await app.request("/api/posts?tag=nonexistent");
      const data = (await res.json()) as { items: unknown[] };
      expect(data.items).toHaveLength(0);
    });

    it("should paginate results", async () => {
      // Set posts_per_page to 2
      db.update(schema.siteSettings)
        .set({ value: "2" })
        .where(eq(schema.siteSettings.key, "posts_per_page"))
        .run();

      for (let i = 0; i < 5; i++) {
        createTestPost({ title: `Post ${i}`, slug: `post-${i}` });
      }

      const res = await app.request("/api/posts?page=1");
      const data = (await res.json()) as {
        items: unknown[];
        total: number;
        page: number;
        totalPages: number;
      };
      expect(data.items).toHaveLength(2);
      expect(data.total).toBe(5);
      expect(data.totalPages).toBe(3);

      // Reset
      db.update(schema.siteSettings)
        .set({ value: "10" })
        .where(eq(schema.siteSettings.key, "posts_per_page"))
        .run();
    });
  });

  describe("GET /api/posts/:param", () => {
    it("should return post by slug and increment viewCount", async () => {
      createTestPost({ title: "My Post", slug: "my-post" });

      const res = await app.request("/api/posts/my-post");
      expect(res.status).toBe(200);
      const data = (await res.json()) as { title: string; viewCount: number };
      expect(data.title).toBe("My Post");
      expect(data.viewCount).toBe(1);

      // Second request with viewed cookie should NOT increment
      const cookie = res.headers.get("Set-Cookie") ?? "";
      const res2 = await app.request("/api/posts/my-post", {
        headers: { Cookie: cookie.split(";")[0] },
      });
      const data2 = (await res2.json()) as { viewCount: number };
      expect(data2.viewCount).toBe(1);
    });

    it("should not increment viewCount for admin", async () => {
      createTestPost({ title: "Admin View", slug: "admin-view" });

      const res = await app.request("/api/posts/admin-view", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { viewCount: number };
      expect(data.viewCount).toBe(0);
    });

    it("should return post by UUID", async () => {
      const post = createTestPost({ title: "UUID Post" });

      const res = await app.request(`/api/posts/${post.id}`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { title: string };
      expect(data.title).toBe("UUID Post");
    });

    it("should return 404 for non-existent post", async () => {
      const res = await app.request("/api/posts/nonexistent-slug");
      expect(res.status).toBe(404);
    });

    it("should return 404 for deleted post", async () => {
      createTestPost({ title: "Deleted", slug: "deleted-post", status: "deleted" });
      const res = await app.request("/api/posts/deleted-post");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/posts", () => {
    it("should create a post with auto-generated slug", async () => {
      const res = await app.request("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: "New Post Title", content: "Some content here" }),
      });
      expect(res.status).toBe(201);
      const data = (await res.json()) as { title: string; slug: string; status: string };
      expect(data.title).toBe("New Post Title");
      expect(data.slug).toBe("new-post-title");
      expect(data.status).toBe("draft");
    });

    it("should create a post with tags", async () => {
      const res = await app.request("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: "Tagged Post",
          content: "Content",
          tags: ["javascript", "react"],
        }),
      });
      expect(res.status).toBe(201);

      // Verify tags via GET
      const data = (await res.json()) as { slug: string };
      const getRes = await app.request(`/api/posts/${data.slug}`);
      const postData = (await getRes.json()) as { tags: { name: string }[] };
      expect(postData.tags).toHaveLength(2);
    });

    it("should treat tags as case-insensitive", async () => {
      // Create first post with "Blog" tag
      const res1 = await app.request("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: "Post One",
          content: "Content",
          tags: ["Blog"],
        }),
      });
      expect(res1.status).toBe(201);

      // Create second post with "blog" tag (different case) — should not error
      const res2 = await app.request("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: "Post Two",
          content: "Content",
          tags: ["blog"],
        }),
      });
      expect(res2.status).toBe(201);

      // Both posts should share the same tag
      const data2 = (await res2.json()) as { slug: string };
      const getRes = await app.request(`/api/posts/${data2.slug}`);
      const postData = (await getRes.json()) as { tags: { name: string }[] };
      expect(postData.tags).toHaveLength(1);
      expect(postData.tags[0]?.name).toBe("blog");
    });

    it("should generate unique slug for duplicate title", async () => {
      createTestPost({ title: "Duplicate", slug: "duplicate" });

      const res = await app.request("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: "Duplicate", content: "Content" }),
      });
      expect(res.status).toBe(201);
      const data = (await res.json()) as { slug: string };
      expect(data.slug).toBe("duplicate-2");
    });

    it("should return 401 without auth", async () => {
      const res = await app.request("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test", content: "Content" }),
      });
      expect(res.status).toBe(401);
    });

    it("should return 400 without title", async () => {
      const res = await app.request("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: "Content only" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/posts/:id", () => {
    it("should update post title and regenerate slug", async () => {
      const post = createTestPost({ title: "Old Title", slug: "old-title" });

      const res = await app.request(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: "Updated Title" }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { title: string; slug: string };
      expect(data.title).toBe("Updated Title");
      expect(data.slug).toBe("updated-title");
    });

    it("should change status from draft to published", async () => {
      const post = createTestPost({ status: "draft" });

      const res = await app.request(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "published" }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { status: string };
      expect(data.status).toBe("published");
    });

    it("should return 404 for non-existent post", async () => {
      const res = await app.request("/api/posts/nonexistent-id", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: "Test" }),
      });
      expect(res.status).toBe(404);
    });

    it("should return 401 without auth", async () => {
      const post = createTestPost();
      const res = await app.request(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/posts/:id", () => {
    it("should soft-delete post", async () => {
      const post = createTestPost({ status: "published" });

      const res = await app.request(`/api/posts/${post.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);

      // Verify it's deleted
      const getRes = await app.request(`/api/posts/${post.slug}`);
      expect(getRes.status).toBe(404);
    });

    it("should return 404 for non-existent post", async () => {
      const res = await app.request("/api/posts/nonexistent-id", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(404);
    });

    it("should return 401 without auth", async () => {
      const post = createTestPost();
      const res = await app.request(`/api/posts/${post.id}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(401);
    });
  });

  describe("Combined feed (local + remote)", () => {
    it("should include remote posts in published feed", async () => {
      const cat = createTestCategory({ name: "Tech", slug: "tech" });
      createTestPost({ title: "Local Post", status: "published", categoryId: cat.id });
      const rb = createTestRemoteBlog();
      createTestRemotePost(rb.id, cat.id, { title: "Remote Post" });

      const res = await app.request("/api/posts");
      const data = (await res.json()) as {
        items: { title: string; isRemote: boolean }[];
        total: number;
      };
      expect(data.total).toBe(2);
      expect(data.items).toHaveLength(2);
      const titles = data.items.map((i) => i.title);
      expect(titles).toContain("Local Post");
      expect(titles).toContain("Remote Post");
    });

    it("should not duplicate remote posts across pages", async () => {
      // perPage is 10 (from seedDefaultSettings)
      // Create 10 local posts (fill page 1) + 2 remote posts
      const cat = createTestCategory({ name: "Dev", slug: "dev" });
      for (let i = 0; i < 10; i++) {
        createTestPost({
          title: `Local ${i}`,
          slug: `local-${i}`,
          status: "published",
          categoryId: cat.id,
          createdAt: new Date(2025, 0, i + 1).toISOString(),
        });
      }
      const rb = createTestRemoteBlog();
      createTestRemotePost(rb.id, cat.id, {
        title: "Remote A",
        remoteCreatedAt: new Date(2025, 0, 15).toISOString(),
        remoteUpdatedAt: new Date(2025, 0, 15).toISOString(),
      });
      createTestRemotePost(rb.id, cat.id, {
        title: "Remote B",
        remoteUri: "https://remote.example.com/posts/b",
        remoteCreatedAt: new Date(2025, 0, 16).toISOString(),
        remoteUpdatedAt: new Date(2025, 0, 16).toISOString(),
      });

      const res1 = await app.request("/api/posts?page=1");
      const page1 = (await res1.json()) as {
        items: { id: string; title: string }[];
        total: number;
        totalPages: number;
      };
      const res2 = await app.request("/api/posts?page=2");
      const page2 = (await res2.json()) as { items: { id: string; title: string }[] };

      expect(page1.total).toBe(12);
      expect(page1.totalPages).toBe(2);
      expect(page1.items).toHaveLength(10);
      expect(page2.items.length).toBeGreaterThan(0);

      // No duplicate IDs across pages
      const allIds = [...page1.items.map((i) => i.id), ...page2.items.map((i) => i.id)];
      expect(new Set(allIds).size).toBe(allIds.length);
    });

    it("should filter remote posts by category", async () => {
      const cat1 = createTestCategory({ name: "Cat1", slug: "cat1" });
      const cat2 = createTestCategory({ name: "Cat2", slug: "cat2" });
      const rb = createTestRemoteBlog();
      createTestRemotePost(rb.id, cat1.id, { title: "In Cat1" });
      createTestRemotePost(rb.id, cat2.id, {
        title: "In Cat2",
        remoteUri: "https://remote.example.com/posts/cat2",
      });

      const res = await app.request("/api/posts?category=cat1");
      const data = (await res.json()) as { items: { title: string }[]; total: number };
      expect(data.total).toBe(1);
      expect(data.items[0]?.title).toBe("In Cat1");
    });

    it("should filter remote posts by search", async () => {
      const cat = createTestCategory({ name: "All", slug: "all-cat" });
      const rb = createTestRemoteBlog();
      createTestRemotePost(rb.id, cat.id, { title: "Matching Title" });
      createTestRemotePost(rb.id, cat.id, {
        title: "Other Post",
        remoteUri: "https://remote.example.com/posts/other",
      });
      createTestPost({ title: "Local Matching Title", status: "published", categoryId: cat.id });

      const res = await app.request("/api/posts?search=Matching");
      const data = (await res.json()) as { items: { title: string }[]; total: number };
      expect(data.total).toBe(2);
      const titles = data.items.map((i) => i.title);
      expect(titles).toContain("Matching Title");
      expect(titles).toContain("Local Matching Title");
    });

    it("should exclude remote posts when tag filter is active", async () => {
      const cat = createTestCategory({ name: "Tagged", slug: "tagged" });
      const post = createTestPost({
        title: "Tagged Post",
        status: "published",
        categoryId: cat.id,
      });
      // Add a tag
      db.insert(schema.tags).values({ id: "tag1", name: "js", slug: "js" }).run();
      db.insert(schema.postTags).values({ postId: post.id, tagId: "tag1" }).run();

      const rb = createTestRemoteBlog();
      createTestRemotePost(rb.id, cat.id, { title: "Remote No Tag" });

      const res = await app.request("/api/posts?tag=js");
      const data = (await res.json()) as {
        items: { title: string; isRemote: boolean }[];
        total: number;
      };
      expect(data.total).toBe(1);
      expect(data.items[0]?.title).toBe("Tagged Post");
      expect(data.items[0]?.isRemote).toBe(false);
    });

    it("should include remoteBlog info in remote post items", async () => {
      const cat = createTestCategory({ name: "Info", slug: "info" });
      const rb = createTestRemoteBlog({ displayName: "Cool Blog", blogTitle: "Cool Title" });
      createTestRemotePost(rb.id, cat.id, { title: "With Blog Info" });

      const res = await app.request("/api/posts");
      const data = (await res.json()) as {
        items: {
          isRemote: boolean;
          remoteBlog: { displayName: string; blogTitle: string } | null;
        }[];
      };
      const remote = data.items.find((i) => i.isRemote);
      expect(remote).toBeDefined();
      expect(remote?.remoteBlog).toBeDefined();
      expect(remote?.remoteBlog?.displayName).toBe("Cool Blog");
      expect(remote?.remoteBlog?.blogTitle).toBe("Cool Title");
    });
  });

  describe("GET /api/posts/tags", () => {
    it("should return a list of all unique tags", async () => {
      await app.request("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: "Post 1",
          content: "Content",
          tags: ["apple", "banana"],
        }),
      });

      await app.request("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: "Post 2",
          content: "Content",
          tags: ["banana", "cherry"],
        }),
      });

      const res = await app.request("/api/posts/tags");
      expect(res.status).toBe(200);
      const tags = (await res.json()) as string[];
      expect(tags).toHaveLength(3);
      expect(tags).toContain("apple");
      expect(tags).toContain("banana");
      expect(tags).toContain("cherry");
    });
  });
});
