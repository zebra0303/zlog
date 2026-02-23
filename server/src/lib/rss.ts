import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { stripMarkdown } from "../lib/markdown.js";

// Helper to escape XML
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc822(dateStr: string): string {
  return new Date(dateStr).toUTCString();
}

function buildRssXml(
  siteUrl: string,
  channelTitle: string,
  channelDesc: string,
  channelLink: string,
  selfUrl: string,
  items: {
    title: string;
    slug: string;
    excerpt: string | null;
    content: string;
    createdAt: string;
    categoryName?: string;
  }[],
): string {
  const rssItems = items.map((item) => {
    const link = `${siteUrl}/posts/${item.slug}`;
    const desc = item.excerpt ?? stripMarkdown(item.content).slice(0, 300);
    return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${escapeXml(desc)}</description>
      <pubDate>${toRfc822(item.createdAt)}</pubDate>${item.categoryName ? `\n      <category>${escapeXml(item.categoryName)}</category>` : ""}
    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${channelLink}</link>
    <description>${escapeXml(channelDesc)}</description>
    <language>en</language>
    <lastBuildDate>${toRfc822(new Date().toISOString())}</lastBuildDate>
    <atom:link href="${selfUrl}" rel="self" type="application/rss+xml"/>
${rssItems.join("\\n")}
  </channel>
</rss>`;
}

export function getRssFeed(siteUrl: string, settings: Record<string, string>) {
  const blogTitle = settings.blog_title ?? "Blog";
  const blogDesc = settings.seo_description ?? "";

  const posts = db
    .select({
      title: schema.posts.title,
      slug: schema.posts.slug,
      excerpt: schema.posts.excerpt,
      content: schema.posts.content,
      createdAt: schema.posts.createdAt,
      categoryName: schema.categories.name,
    })
    .from(schema.posts)
    .leftJoin(schema.categories, eq(schema.posts.categoryId, schema.categories.id))
    .where(eq(schema.posts.status, "published"))
    .orderBy(desc(schema.posts.createdAt))
    .limit(20)
    .all();

  return buildRssXml(
    siteUrl,
    blogTitle,
    blogDesc,
    siteUrl,
    `${siteUrl}/rss.xml`,
    posts.map((p) => ({ ...p, categoryName: p.categoryName ?? undefined })),
  );
}

export function getCategoryRssFeed(
  siteUrl: string,
  slug: string,
  settings: Record<string, string>,
) {
  const ownerInfo = db.select().from(schema.owner).get();
  const blogTitle = ownerInfo?.blogTitle ?? "Blog";

  const category = db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.slug, slug))
    .get();

  if (!category) return null;

  const posts = db
    .select({
      title: schema.posts.title,
      slug: schema.posts.slug,
      excerpt: schema.posts.excerpt,
      content: schema.posts.content,
      createdAt: schema.posts.createdAt,
    })
    .from(schema.posts)
    .where(and(eq(schema.posts.status, "published"), eq(schema.posts.categoryId, category.id)))
    .orderBy(desc(schema.posts.createdAt))
    .limit(20)
    .all();

  const seoDesc = settings.seo_description ?? "";
  const catDesc = (category.description ?? "").trim();
  const channelTitle = `${blogTitle} - ${category.name}`;
  const channelLink = `${siteUrl}/category/${category.slug}`;

  return buildRssXml(
    siteUrl,
    channelTitle,
    catDesc.length > 0 ? catDesc : seoDesc,
    channelLink,
    `${siteUrl}/category/${category.slug}/rss.xml`,
    posts.map((p) => ({ ...p, categoryName: category.name })),
  );
}
