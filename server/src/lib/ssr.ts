import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function getSiteSettings(): Record<string, string> {
  const rows = db.select().from(schema.siteSettings).all();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  if (!map.blog_title) {
    const owner = db.select().from(schema.owner).limit(1).get();
    if (owner?.blogTitle) map.blog_title = owner.blogTitle;
  }
  return map;
}

interface SsrMeta {
  title: string;
  description?: string;
  image?: string;
  canonicalUrl: string;
  ogType: string;
  jsonLd?: Record<string, unknown>;
}

function buildSsrTags(meta: SsrMeta): string {
  const lines: string[] = [];
  lines.push(`<title>${escapeHtml(meta.title)}</title>`);
  lines.push(`<link rel="canonical" href="${escapeHtml(meta.canonicalUrl)}" />`);
  if (meta.description) {
    lines.push(`<meta name="description" content="${escapeHtml(meta.description)}" />`);
  }
  lines.push(`<meta property="og:title" content="${escapeHtml(meta.title)}" />`);
  if (meta.description) {
    lines.push(`<meta property="og:description" content="${escapeHtml(meta.description)}" />`);
  }
  if (meta.image) {
    lines.push(`<meta property="og:image" content="${escapeHtml(meta.image)}" />`);
  }
  lines.push(`<meta property="og:type" content="${escapeHtml(meta.ogType)}" />`);
  lines.push(`<meta property="og:url" content="${escapeHtml(meta.canonicalUrl)}" />`);
  lines.push(`<meta name="twitter:card" content="summary_large_image" />`);
  lines.push(`<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`);
  if (meta.description) {
    lines.push(`<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`);
  }
  if (meta.image) {
    lines.push(`<meta name="twitter:image" content="${escapeHtml(meta.image)}" />`);
  }
  if (meta.jsonLd) {
    lines.push(`<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`);
  }
  return lines.join("\\n    ");
}

function toAbsoluteUrl(url: string | undefined, base: string): string | undefined {
  if (!url) return url;
  if (url.startsWith("/")) return base + url;
  return url;
}

function buildCategoryMeta(
  cat: { name: string; slug: string; description: string | null },
  blogTitle: string,
  seoDesc: string | undefined,
  seoImage: string | undefined,
  canonicalBase: string,
): SsrMeta {
  const catDesc = cat.description ?? seoDesc;
  return {
    title: `${blogTitle} - ${cat.name}`,
    description: catDesc,
    image: toAbsoluteUrl(seoImage, canonicalBase),
    canonicalUrl: `${canonicalBase}/category/${cat.slug}`,
    ogType: "website",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: cat.name,
      ...(catDesc && { description: catDesc }),
      url: `${canonicalBase}/category/${cat.slug}`,
      isPartOf: { "@type": "WebSite", name: blogTitle, url: canonicalBase },
    },
  };
}

function buildPageMeta(
  pathname: string,
  url: URL,
  blogTitle: string,
  seoDesc: string | undefined,
  seoImage: string | undefined,
  canonicalBase: string,
): SsrMeta {
  const defaultMeta: SsrMeta = {
    title: blogTitle,
    description: seoDesc,
    image: toAbsoluteUrl(seoImage, canonicalBase),
    canonicalUrl: `${canonicalBase}${pathname}`,
    ogType: "website",
  };

  const postMatch = /^\/posts\/([^/]+)$/.exec(pathname);
  if (postMatch?.[1]) {
    const slug = postMatch[1];
    const post = db.select().from(schema.posts).where(eq(schema.posts.slug, slug)).get();
    if (post?.status === "published") {
      const category = post.categoryId
        ? db
            .select({ name: schema.categories.name, slug: schema.categories.slug })
            .from(schema.categories)
            .where(eq(schema.categories.id, post.categoryId))
            .get()
        : null;
      const tagRows = db
        .select({ name: schema.tags.name })
        .from(schema.postTags)
        .innerJoin(schema.tags, eq(schema.postTags.tagId, schema.tags.id))
        .where(eq(schema.postTags.postId, post.id))
        .all();
      const postDesc = post.excerpt ?? seoDesc;
      const postImage = toAbsoluteUrl(post.coverImage ?? seoImage, canonicalBase);
      return {
        title: `${blogTitle} - ${post.title}`,
        description: postDesc,
        image: postImage,
        canonicalUrl: `${canonicalBase}/posts/${post.slug}`,
        ogType: "article",
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          ...(postDesc && { description: postDesc }),
          ...(postImage && { image: postImage }),
          datePublished: post.createdAt,
          dateModified: post.updatedAt,
          author: { "@type": "Person", name: blogTitle, url: `${canonicalBase}/profile` },
          publisher: {
            "@type": "Organization",
            name: blogTitle,
            logo: { "@type": "ImageObject", url: `${canonicalBase}/favicons/favicon.svg` },
          },
          mainEntityOfPage: { "@type": "WebPage", "@id": `${canonicalBase}/posts/${post.slug}` },
          ...(category && { articleSection: category.name }),
          ...(tagRows.length > 0 && { keywords: tagRows.map((t) => t.name) }),
        },
      };
    }
    return defaultMeta;
  }

  const catMatch = /^\/category\/([^/]+)$/.exec(pathname);
  if (catMatch?.[1]) {
    const cat = db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.slug, catMatch[1]))
      .get();
    if (cat) return buildCategoryMeta(cat, blogTitle, seoDesc, seoImage, canonicalBase);
    return defaultMeta;
  }

  const queryCat = url.searchParams.get("category");
  if (pathname === "/" && queryCat) {
    const cat = db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.slug, queryCat))
      .get();
    if (cat) return buildCategoryMeta(cat, blogTitle, seoDesc, seoImage, canonicalBase);
    return { ...defaultMeta, canonicalUrl: canonicalBase };
  }

  if (pathname === "/") {
    return {
      title: blogTitle,
      description: seoDesc,
      image: toAbsoluteUrl(seoImage, canonicalBase),
      canonicalUrl: canonicalBase,
      ogType: "website",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: blogTitle,
        url: canonicalBase,
        ...(seoDesc && { description: seoDesc }),
        ...(seoImage && { image: seoImage }),
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${canonicalBase}/?search={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    };
  }

  return defaultMeta;
}

export function handleSsr(
  pathname: string,
  url: URL,
  indexHtmlTemplate: string,
  settings: Record<string, string>,
  siteUrl: string,
) {
  const blogTitle = settings.blog_title ?? "zlog";
  const seoDesc = settings.seo_description;
  const seoImage = settings.seo_og_image;
  const canonicalBase = (settings.canonical_url ?? siteUrl ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );

  const meta = buildPageMeta(pathname, url, blogTitle, seoDesc, seoImage, canonicalBase);
  return indexHtmlTemplate.replace("<!--SSR_META-->", buildSsrTags(meta));
}

export function getSitemap(siteUrl: string) {
  const posts = db
    .select({ slug: schema.posts.slug, updatedAt: schema.posts.updatedAt })
    .from(schema.posts)
    .where(eq(schema.posts.status, "published"))
    .orderBy(desc(schema.posts.createdAt))
    .limit(49000)
    .all();
  const categories = db.select({ slug: schema.categories.slug }).from(schema.categories).all();

  const urls = [
    `<url><loc>${siteUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${siteUrl}/profile</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
    ...categories.map(
      (cat) =>
        `<url><loc>${siteUrl}/category/${cat.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    ),
    ...posts.map(
      (post) =>
        `<url><loc>${siteUrl}/posts/${post.slug}</loc><lastmod>${post.updatedAt}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`,
    ),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\\n")}
</urlset>`;
}
