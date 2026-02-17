import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createApp } from "../app.js";
import {
  seedTestAdmin,
  seedDefaultSettings,
  createTestCategory,
  createTestPost,
  cleanDb,
} from "./helpers.js";
import { sqlite } from "../db/index.js";

describe("SEO Endpoints", () => {
  const app = createApp();

  beforeAll(() => {
    cleanDb();
    seedTestAdmin();
    seedDefaultSettings();
  });

  beforeEach(() => {
    sqlite.exec(
      "DELETE FROM post_tags; DELETE FROM tags; DELETE FROM posts; DELETE FROM categories;",
    );
  });

  describe("GET /robots.txt", () => {
    it("should return correct robots.txt", async () => {
      const res = await app.request("/robots.txt");
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("User-agent: *");
      expect(text).toContain("Allow: /");
      expect(text).toContain("Disallow: /api/");
      expect(text).toContain("Sitemap: http://localhost:3000/sitemap.xml");
    });
  });

  describe("GET /sitemap.xml", () => {
    it("should return valid XML with homepage and profile", async () => {
      const res = await app.request("/sitemap.xml");
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('<?xml version="1.0"');
      expect(text).toContain("<urlset");
      expect(text).toContain("http://localhost:3000/");
      expect(text).toContain("http://localhost:3000/profile");
    });

    it("should include published posts and categories", async () => {
      createTestCategory({ name: "Tech", slug: "tech" });
      createTestPost({ title: "Published", slug: "published-post", status: "published" });
      createTestPost({ title: "Draft", slug: "draft-post", status: "draft" });

      const res = await app.request("/sitemap.xml");
      const text = await res.text();
      expect(text).toContain("/posts/published-post");
      expect(text).not.toContain("/posts/draft-post");
      expect(text).toContain("/category/tech");
    });
  });

  describe("GET /rss.xml", () => {
    it("should return valid RSS feed", async () => {
      createTestPost({ title: "RSS Post", slug: "rss-post", status: "published" });

      const res = await app.request("/rss.xml");
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/rss+xml");
      const text = await res.text();
      expect(text).toContain("<rss");
      expect(text).toContain("<title>Test Blog</title>");
      expect(text).toContain("RSS Post");
    });
  });

  describe("GET /category/:slug/rss.xml", () => {
    it("should return RSS feed for category", async () => {
      const cat = createTestCategory({ name: "Dev", slug: "dev" });
      createTestPost({
        title: "Dev Post",
        slug: "dev-post",
        categoryId: cat.id,
        status: "published",
      });

      const res = await app.request("/category/dev/rss.xml");
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Dev Post");
      expect(text).toContain("Test Blog - Dev");
    });

    it("should return Not Found RSS for non-existent category", async () => {
      const res = await app.request("/category/nonexistent/rss.xml");
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Not Found");
    });
  });

  describe("GET /api/health", () => {
    it("should return ok status", async () => {
      const res = await app.request("/api/health");
      expect(res.status).toBe(200);
      const data = (await res.json()) as { status: string; timestamp: string };
      expect(data.status).toBe("ok");
      expect(data.timestamp).toBeDefined();
    });
  });
});
