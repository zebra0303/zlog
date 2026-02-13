// .env 로딩: tsx --env-file=../.env 로 이미 로드됨
// 프로덕션 fallback: dotenv로 명시적 경로 지정
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 루트 .env를 명시적으로 로드 (--env-file로 이미 로드된 경우 중복은 무시됨)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { bootstrap } from "./services/bootstrap.js";
import { errorHandler } from "./middleware/errorHandler.js";
import auth from "./routes/auth.js";
import postsRoute from "./routes/posts.js";
import categoriesRoute from "./routes/categories.js";
import commentsRoute from "./routes/comments.js";
import settingsRoute from "./routes/settings.js";
import federationRoute from "./routes/federation.js";
import { db } from "./db/index.js";
import * as schema from "./db/schema.js";
import { eq, desc } from "drizzle-orm";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: process.env.SITE_URL ?? "http://localhost:5173",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use("/uploads/*", serveStatic({ root: "./" }));
app.use("/assets/*", serveStatic({ root: "./client/dist" }));

app.route("/api/auth", auth);
app.route("/api/posts", postsRoute);
app.route("/api/categories", categoriesRoute);
app.route("/api", commentsRoute);
app.route("/api", settingsRoute);
app.route("/api/federation", federationRoute);

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

app.get("/sitemap.xml", async (c) => {
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
    ...categories.map((cat) => `<url><loc>${siteUrl}/category/${cat.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`),
    ...posts.map((post) => `<url><loc>${siteUrl}/posts/${post.slug}</loc><lastmod>${post.updatedAt}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`),
  ];

  c.header("Content-Type", "application/xml");
  return c.body(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`);
});

app.get("*", serveStatic({ root: "./client/dist", path: "index.html" }));

app.onError(errorHandler);

const port = Number(process.env.PORT) || 3000;

async function main() {
  await bootstrap();
  serve({ fetch: app.fetch, port }, () => {
    console.log(`🦓 zlog 서버가 포트 ${port}에서 실행 중입니다.`);
    console.log(`📋 환경변수 로드됨: ADMIN_EMAIL=${process.env.ADMIN_EMAIL ?? "(미설정)"}`);
  });
}

void main();
