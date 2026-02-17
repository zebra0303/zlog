import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createApp } from "../app.js";
import {
  seedTestAdmin,
  seedDefaultSettings,
  getAuthToken,
  createTestCategory,
  createTestPost,
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
      "DELETE FROM post_tags; DELETE FROM tags; DELETE FROM posts; DELETE FROM categories;",
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

      // Second request should increment again
      const res2 = await app.request("/api/posts/my-post");
      const data2 = (await res2.json()) as { viewCount: number };
      expect(data2.viewCount).toBe(2);
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
});
