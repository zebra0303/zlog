import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  cleanDb,
  seedDefaultSettings,
  createTestCategory,
  createTestPost,
  seedTestAdmin,
} from "./helpers.js";
import { getRssFeed, getCategoryRssFeed } from "../lib/rss.js";

describe("RSS Feed Generator", () => {
  beforeAll(() => {
    cleanDb();
    seedTestAdmin();
    seedDefaultSettings();
  });

  beforeEach(() => {
    cleanDb();
    seedTestAdmin();
    seedDefaultSettings();
  });

  it("should generate a valid RSS feed for the whole blog", () => {
    const cat = createTestCategory({ name: "Tech" });
    createTestPost({ title: "Post 1", slug: "post-1", categoryId: cat.id, status: "published" });
    createTestPost({ title: "Post 2", slug: "post-2", categoryId: cat.id, status: "published" });
    createTestPost({ title: "Draft", slug: "draft-post", categoryId: cat.id, status: "draft" });

    const settings = { blog_title: "My Blog", seo_description: "Cool blog" };
    const xml = getRssFeed("http://localhost:3000", settings);

    expect(xml).toContain("<title>My Blog</title>");
    expect(xml).toContain("<description>Cool blog</description>");
    expect(xml).toContain("<item>");
    expect(xml).toContain("<title>Post 1</title>");
    expect(xml).toContain("<title>Post 2</title>");
    expect(xml).not.toContain("<title>Draft</title>");
    expect(xml).toContain("<category>Tech</category>");
  });

  it("should generate a valid RSS feed for a specific category", () => {
    const cat1 = createTestCategory({ name: "Tech", slug: "tech" });
    const cat2 = createTestCategory({ name: "Life", slug: "life" });
    createTestPost({
      title: "Tech Post",
      slug: "tech-post",
      categoryId: cat1.id,
      status: "published",
    });
    createTestPost({
      title: "Life Post",
      slug: "life-post",
      categoryId: cat2.id,
      status: "published",
    });

    const settings = { seo_description: "Main desc" };
    const xml = getCategoryRssFeed("http://localhost:3000", "tech", settings);

    expect(xml).toContain("<title>Test Blog - Tech</title>");
    expect(xml).toContain("Tech Post");
    expect(xml).not.toContain("Life Post");
  });

  it("should return null for non-existent category RSS", () => {
    const xml = getCategoryRssFeed("http://localhost:3000", "none", {});
    expect(xml).toBeNull();
  });
});
