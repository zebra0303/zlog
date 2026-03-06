import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { handleSsr, getSiteSettings } from "../lib/ssr.js";
import { seedTestAdmin, seedDefaultSettings, cleanDb, createTestPost } from "./helpers.js";
import { db, sqlite } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateId } from "../lib/uuid.js";

const INDEX_TEMPLATE = `<!DOCTYPE html><html><head><!--SSR_META--></head><body></body></html>`;

describe("SSR handleSsr", () => {
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

  describe("font injection", () => {
    it("should inject both preload and stylesheet tags for known font_family", () => {
      // Set font_family to pretendard
      db.insert(schema.siteSettings)
        .values({
          id: generateId(),
          key: "font_family",
          value: "pretendard",
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: schema.siteSettings.key,
          set: { value: "pretendard" },
        })
        .run();

      const settings = getSiteSettings();
      const url = new URL("http://localhost:3000/");
      const html = handleSsr("/", url, INDEX_TEMPLATE, settings, "http://localhost:3000");

      expect(html).toContain('<link rel="preload" as="style"');
      expect(html).toContain('<link rel="stylesheet"');
      expect(html).toContain("pretendardvariable.min.css");
      expect(html).toContain("crossorigin />");
    });

    it("should inject font tags for noto-sans-kr", () => {
      db.update(schema.siteSettings)
        .set({ value: "noto-sans-kr" })
        .where(eq(schema.siteSettings.key, "font_family"))
        .run();

      const settings = getSiteSettings();
      const url = new URL("http://localhost:3000/");
      const html = handleSsr("/", url, INDEX_TEMPLATE, settings, "http://localhost:3000");

      expect(html).toContain('<link rel="preload" as="style"');
      expect(html).toContain('<link rel="stylesheet"');
      expect(html).toContain("fonts.googleapis.com");
    });

    it("should not inject font tags when font_family is not set", () => {
      db.delete(schema.siteSettings).where(eq(schema.siteSettings.key, "font_family")).run();

      const settings = getSiteSettings();
      const url = new URL("http://localhost:3000/");
      const html = handleSsr("/", url, INDEX_TEMPLATE, settings, "http://localhost:3000");

      expect(html).not.toContain('<link rel="preload"');
      expect(html).not.toContain('<link rel="stylesheet"');
    });

    it("should not inject font tags for unknown font_family", () => {
      db.insert(schema.siteSettings)
        .values({
          id: generateId(),
          key: "font_family",
          value: "unknown-font",
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: schema.siteSettings.key,
          set: { value: "unknown-font" },
        })
        .run();

      const settings = getSiteSettings();
      const url = new URL("http://localhost:3000/");
      const html = handleSsr("/", url, INDEX_TEMPLATE, settings, "http://localhost:3000");

      expect(html).not.toContain('<link rel="preload"');
      expect(html).not.toContain('<link rel="stylesheet"');
    });
  });

  describe("SSR meta tags", () => {
    it("should inject title and canonical for homepage", () => {
      const settings = getSiteSettings();
      const url = new URL("http://localhost:3000/");
      const html = handleSsr("/", url, INDEX_TEMPLATE, settings, "http://localhost:3000");

      expect(html).toContain("<title>Test Blog</title>");
      expect(html).toContain('<link rel="canonical"');
    });

    it("should inject post-specific meta for published posts", () => {
      createTestPost({
        title: "SSR Test Post",
        slug: "ssr-test-post",
        status: "published",
        excerpt: "SSR excerpt",
      });

      const settings = getSiteSettings();
      const url = new URL("http://localhost:3000/posts/ssr-test-post");
      const html = handleSsr(
        "/posts/ssr-test-post",
        url,
        INDEX_TEMPLATE,
        settings,
        "http://localhost:3000",
      );

      expect(html).toContain("Test Blog - SSR Test Post");
      expect(html).toContain("SSR excerpt");
      expect(html).toContain('"@type":"BlogPosting"');
    });
  });
});
