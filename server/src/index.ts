// .env 로딩: tsx --env-file=../.env 로 이미 로드됨
// 프로덕션 fallback: dotenv로 명시적 경로 지정
import dotenv from "dotenv";
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
    background_color: "#FAF9FF",
    theme_color: "#6C5CE7",
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
Allow: /
Disallow: /admin
Disallow: /settings
Disallow: /api/

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

app.get("*", serveStatic({ root: CLIENT_DIST, path: "index.html" }));

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
