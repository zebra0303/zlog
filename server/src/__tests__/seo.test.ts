import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createApp } from "../app.js";
import {
  seedTestAdmin,
  seedDefaultSettings,
  createTestCategory,
  createTestPost,
  cleanDb,
} from "./helpers.js";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
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

    it("should use canonical_url from DB settings over SITE_URL env", async () => {
      db.update(schema.siteSettings)
        .set({ value: "https://myblog.example.com" })
        .where(eq(schema.siteSettings.key, "canonical_url"))
        .run();

      const res = await app.request("/robots.txt");
      const text = await res.text();
      expect(text).toContain("Sitemap: https://myblog.example.com/sitemap.xml");
      expect(text).not.toContain("localhost:3000");

      // Restore
      db.update(schema.siteSettings)
        .set({ value: "http://localhost:3000" })
        .where(eq(schema.siteSettings.key, "canonical_url"))
        .run();
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

    it("should use canonical_url from DB settings over SITE_URL env", async () => {
      db.update(schema.siteSettings)
        .set({ value: "https://myblog.example.com" })
        .where(eq(schema.siteSettings.key, "canonical_url"))
        .run();
      createTestPost({ title: "Canonical Test", slug: "canonical-test", status: "published" });

      const res = await app.request("/sitemap.xml");
      const text = await res.text();
      expect(text).toContain("https://myblog.example.com/posts/canonical-test");
      expect(text).not.toContain("localhost:3000");

      // Restore
      db.update(schema.siteSettings)
        .set({ value: "http://localhost:3000" })
        .where(eq(schema.siteSettings.key, "canonical_url"))
        .run();
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

    it("should use seo_description from settings as description", async () => {
      createTestPost({ title: "Desc Post", slug: "desc-post", status: "published" });

      const res = await app.request("/rss.xml");
      const text = await res.text();
      expect(text).toContain("<description>Test blog description</description>");
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

    it("should use category description when available", async () => {
      const cat = createTestCategory({
        name: "WithDesc",
        slug: "with-desc",
        description: "Category specific description",
      });
      createTestPost({
        title: "Cat Desc Post",
        slug: "cat-desc-post",
        categoryId: cat.id,
        status: "published",
      });

      const res = await app.request("/category/with-desc/rss.xml");
      const text = await res.text();
      expect(text).toContain("<description>Category specific description</description>");
    });

    it("should fall back to seo_description when category has no description", async () => {
      const cat = createTestCategory({ name: "NoDesc", slug: "no-desc" });
      createTestPost({
        title: "No Desc Post",
        slug: "no-desc-post",
        categoryId: cat.id,
        status: "published",
      });

      const res = await app.request("/category/no-desc/rss.xml");
      const text = await res.text();
      expect(text).toContain("<description>Test blog description</description>");
    });

    it("should return Not Found RSS for non-existent category", async () => {
      const res = await app.request("/category/nonexistent/rss.xml");
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Not Found");
    });
  });

  describe("SSR og:image absolute URL", () => {
    it("should render og:image with absolute URL for posts with cover image", async () => {
      createTestPost({
        title: "OG Test",
        slug: "og-test",
        status: "published",
        coverImage: "/uploads/images/test.webp",
      });

      const res = await app.request("/posts/og-test");
      const html = await res.text();
      expect(html).toContain(
        '<meta property="og:image" content="http://localhost:3000/uploads/images/test.webp"',
      );
    });

    it("should render og:image with absolute URL when already absolute", async () => {
      createTestPost({
        title: "OG Abs",
        slug: "og-abs",
        status: "published",
        coverImage: "https://example.com/img.jpg",
      });

      const res = await app.request("/posts/og-abs");
      const html = await res.text();
      expect(html).toContain('<meta property="og:image" content="https://example.com/img.jpg"');
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
