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
import { sqlite } from "../db/index.js";

describe("Categories API", () => {
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
    sqlite.exec("DELETE FROM post_tags; DELETE FROM posts; DELETE FROM categories;");
  });

  describe("GET /api/categories", () => {
    it("should return empty array when no categories", async () => {
      const res = await app.request("/api/categories");
      expect(res.status).toBe(200);
      const data = (await res.json()) as unknown[];
      expect(data).toEqual([]);
    });

    it("should return categories with postCount", async () => {
      const cat = createTestCategory({ name: "Tech", slug: "tech" });
      createTestPost({ categoryId: cat.id, status: "published", slug: "tech-post-1" });
      createTestPost({ categoryId: cat.id, status: "draft", slug: "tech-post-2" });

      const res = await app.request("/api/categories");
      expect(res.status).toBe(200);
      const data = (await res.json()) as { postCount: number; name: string }[];
      expect(data).toHaveLength(1);
      const first = data[0];
      expect(first).toBeDefined();
      expect(first?.name).toBe("Tech");
      expect(first?.postCount).toBe(1); // only published
    });
  });

  describe("GET /api/categories/:slug", () => {
    it("should return category by slug", async () => {
      createTestCategory({ name: "Design", slug: "design" });
      const res = await app.request("/api/categories/design");
      expect(res.status).toBe(200);
      const data = (await res.json()) as { name: string };
      expect(data.name).toBe("Design");
    });

    it("should return 404 for non-existent slug", async () => {
      const res = await app.request("/api/categories/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/categories", () => {
    it("should create category with auto-generated slug", async () => {
      const res = await app.request("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: "New Category" }),
      });
      expect(res.status).toBe(201);
      const data = (await res.json()) as { name: string; slug: string };
      expect(data.name).toBe("New Category");
      expect(data.slug).toBe("new-category");
    });

    it("should return 401 without auth", async () => {
      const res = await app.request("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test" }),
      });
      expect(res.status).toBe(401);
    });

    it("should return 400 without name", async () => {
      const res = await app.request("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/categories/:id", () => {
    it("should update category name and regenerate slug", async () => {
      const cat = createTestCategory({ name: "Old Name", slug: "old-name" });
      const res = await app.request(`/api/categories/${cat.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: "New Name" }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { name: string; slug: string };
      expect(data.name).toBe("New Name");
      expect(data.slug).toBe("new-name");
    });

    it("should return 404 for non-existent id", async () => {
      const res = await app.request("/api/categories/nonexistent-id", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: "Test" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/categories/:id", () => {
    it("should delete category and nullify posts categoryId", async () => {
      const cat = createTestCategory({ name: "ToDelete", slug: "to-delete" });
      const post = createTestPost({ categoryId: cat.id });

      const res = await app.request(`/api/categories/${cat.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);

      // Verify post's categoryId is null
      const postRes = await app.request(`/api/posts/${post.slug}`);
      const postData = (await postRes.json()) as { categoryId: string | null };
      expect(postData.categoryId).toBeNull();
    });

    it("should return 401 without auth", async () => {
      const cat = createTestCategory();
      const res = await app.request(`/api/categories/${cat.id}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(401);
    });
  });
});
