// .env 로딩: tsx --env-file=../.env 로 이미 로드됨
// 프로덕션 fallback: dotenv로 명시적 경로 지정
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");
// 루트 .env를 명시적으로 로드 (--env-file로 이미 로드된 경우 중복은 무시됨)
dotenv.config({ path: path.resolve(PROJECT_ROOT, ".env") });

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { bootstrap } from "./services/bootstrap.js";
import { startSyncWorker } from "./services/syncService.js";
import { errorHandler } from "./middleware/errorHandler.js";
import auth from "./routes/auth.js";
import postsRoute from "./routes/posts.js";
import categoriesRoute from "./routes/categories.js";
import commentsRoute from "./routes/comments.js";
import settingsRoute from "./routes/settings.js";
import federationRoute from "./routes/federation.js";
import oauthRoute from "./routes/oauth.js";
import { db } from "./db/index.js";
import * as schema from "./db/schema.js";
import { eq, desc, and } from "drizzle-orm";

const app = new Hono();

// Federation API는 다른 블로그(다른 origin)에서도 호출 가능해야 하므로 CORS 허용
app.use(
  "/api/federation/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(
  "*",
  cors({
    origin: process.env.SITE_URL ?? "http://localhost:5173",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

const CLIENT_DIST = path.resolve(PROJECT_ROOT, "client/dist");

app.use("/uploads/*", serveStatic({ root: "./" }));
app.use("/assets/*", serveStatic({ root: CLIENT_DIST }));
app.use("/img/*", serveStatic({ root: CLIENT_DIST }));
app.use("/favicons/*", serveStatic({ root: CLIENT_DIST }));

// 동적 PWA 매니페스트 — 블로그 제목과 프로필 아바타 사용
app.get("/site.webmanifest", (c) => {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const ownerRecord = db.select().from(schema.owner).get();
  const blogTitle = ownerRecord?.blogTitle ?? "zlog";
  const blogDesc = ownerRecord?.blogDescription ?? "관심 있는 모든 글, 내 블로그 하나로";

  // 헤더 어두운 모드 배경색 → theme_color
  const themeColorRow = db
    .select()
    .from(schema.siteSettings)
    .where(eq(schema.siteSettings.key, "header_bg_color_dark"))
    .get();
  const themeColor = themeColorRow?.value ?? "#6C5CE7";

  // 아이콘: 프로필 아바타가 있으면 사용, 없으면 기본 favicon
  const icons: { src: string; sizes: string; type: string; purpose: string }[] = [];
  if (ownerRecord?.avatarUrl) {
    const uuid = ownerRecord.avatarUrl.split("/").pop()?.replace(".webp", "") ?? "";
    icons.push(
      {
        src: `${siteUrl}/uploads/avatar/192/${uuid}.webp`,
        sizes: "192x192",
        type: "image/webp",
        purpose: "any maskable",
      },
      {
        src: `${siteUrl}/uploads/avatar/256/${uuid}.webp`,
        sizes: "256x256",
        type: "image/webp",
        purpose: "any maskable",
      },
    );
  } else {
    icons.push({
      src: "/favicons/favicon.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any maskable",
    });
  }

  const manifest = {
    name: blogTitle,
    short_name: blogTitle.length > 12 ? blogTitle.slice(0, 12) : blogTitle,
    id: "/",
    description: blogDesc,
    start_url: "/",
    scope: "/",
    display: "standalone" as const,
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    background_color: themeColor,
    theme_color: themeColor,
    icons,
  };

  c.header("Content-Type", "application/manifest+json");
  c.header("Cache-Control", "public, max-age=3600");
  return c.body(JSON.stringify(manifest));
});

app.get("/sw.js", serveStatic({ root: CLIENT_DIST, path: "sw.js" }));
app.route("/api/auth", auth);
app.route("/api/posts", postsRoute);
app.route("/api/categories", categoriesRoute);
app.route("/api", commentsRoute);
app.route("/api", settingsRoute);
app.route("/api/federation", federationRoute);
app.route("/api/oauth", oauthRoute);

app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/robots.txt", (c) => {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  return c.text(`User-agent: *
Disallow: /

Allow: /$
Allow: /?category=
Allow: /profile
Allow: /category/
Allow: /posts/

Sitemap: ${siteUrl}/sitemap.xml`);
});

app.get("/sitemap.xml", (c) => {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const posts = db
    .select({ slug: schema.posts.slug, updatedAt: schema.posts.updatedAt })
    .from(schema.posts)
    .where(eq(schema.posts.status, "published"))
    .orderBy(desc(schema.posts.createdAt))
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

  c.header("Content-Type", "application/xml");
  return c.body(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`);
});

// ============ RSS 피드 ============

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
    const desc = item.excerpt ?? item.content.replace(/[#*`>[\]!()_~-]/g, "").slice(0, 300);
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
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${rssItems.join("\n")}
  </channel>
</rss>`;
}

// 전체 블로그 RSS 피드
app.get("/rss.xml", (c) => {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const ownerInfo = db.select().from(schema.owner).get();
  const blogTitle = ownerInfo?.blogTitle ?? "Blog";
  const blogDesc = ownerInfo?.blogDescription ?? "";

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

  const xml = buildRssXml(
    siteUrl,
    blogTitle,
    blogDesc,
    siteUrl,
    posts.map((p) => ({ ...p, categoryName: p.categoryName ?? undefined })),
  );
  c.header("Content-Type", "application/rss+xml; charset=utf-8");
  return c.body(xml);
});

// 카테고리별 RSS 피드
app.get("/category/:slug/rss.xml", (c) => {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const slug = c.req.param("slug");
  const ownerInfo = db.select().from(schema.owner).get();
  const blogTitle = ownerInfo?.blogTitle ?? "Blog";

  const category = db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.slug, slug))
    .get();
  if (!category) {
    c.header("Content-Type", "application/rss+xml; charset=utf-8");
    return c.body(
      `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Not Found</title></channel></rss>`,
    );
  }

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

  const channelTitle = `${blogTitle} - ${category.name}`;
  const channelLink = `${siteUrl}/category/${category.slug}`;
  const xml = buildRssXml(
    siteUrl,
    channelTitle,
    category.description ?? "",
    channelLink,
    posts.map((p) => ({ ...p, categoryName: category.name })),
  );
  c.header("Content-Type", "application/rss+xml; charset=utf-8");
  return c.body(xml);
});

// ============ SSR 메타 태그 + JSON-LD 주입 ============

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getSiteSettings(): Record<string, string> {
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
  return lines.join("\n    ");
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
    image: seoImage,
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
    image: seoImage,
    canonicalUrl: `${canonicalBase}${pathname}`,
    ogType: "website",
  };

  // /posts/:slug → BlogPosting
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
      const postImage = post.coverImage ?? seoImage;
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

  // /category/:slug → CollectionPage
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

  // /?category=xxx → CollectionPage
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

  // / → WebSite
  if (pathname === "/") {
    return {
      title: blogTitle,
      description: seoDesc,
      image: seoImage,
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

let indexHtmlTemplate = "";

app.get("*", (c) => {
  if (!indexHtmlTemplate) {
    const filePath = path.join(CLIENT_DIST, "index.html");
    if (!fs.existsSync(filePath)) {
      return c.text("Not Found", 404);
    }
    indexHtmlTemplate = fs.readFileSync(filePath, "utf-8");
  }

  const settings = getSiteSettings();
  const blogTitle = settings.blog_title ?? "zlog";
  const seoDesc = settings.seo_description;
  const seoImage = settings.seo_og_image;
  const canonicalBase = (
    settings.canonical_url ??
    process.env.SITE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");

  const url = new URL(c.req.url);
  const pathname = url.pathname;

  const meta = buildPageMeta(pathname, url, blogTitle, seoDesc, seoImage, canonicalBase);

  const html = indexHtmlTemplate.replace("<!--SSR_META-->", buildSsrTags(meta));
  return c.html(html);
});

app.onError(errorHandler);

const port = Number(process.env.PORT) || 3000;

function main() {
  bootstrap();
  startSyncWorker();
  serve({ fetch: app.fetch, port }, () => {
    console.log(`🦓 zlog 서버가 포트 ${port}에서 실행 중입니다.`);
    console.log(`📋 환경변수 로드됨: ADMIN_EMAIL=${process.env.ADMIN_EMAIL ?? "(미설정)"}`);
  });
}

main();
