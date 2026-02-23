import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { apiReference } from "@scalar/hono-api-reference";
import { errorHandler } from "../middleware/errorHandler.js";
import auth from "../routes/auth.js";
import postsRoute from "../routes/posts/index.js";
import categoriesRoute from "../routes/categories.js";
import commentsRoute from "../routes/comments.js";
import settingsRoute from "../routes/settings.js";
import federationRoute from "../routes/federation.js";
import oauthRoute from "../routes/oauth.js";
import analyticsRoute from "../routes/analytics.js";
import uploadRoute from "../routes/upload/index.js";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getRssFeed, getCategoryRssFeed } from "./rss.js";
import { handleSsr, getSitemap, getSiteSettings } from "./ssr.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const CLIENT_DIST = path.resolve(PROJECT_ROOT, "client/dist");

const getEnv = (key: string, defaultVal = "") => process.env[key] ?? defaultVal;

export function createApp() {
  const app = new OpenAPIHono();

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
      origin: getEnv("SITE_URL", "http://localhost:5173"),
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.use("/uploads/*", serveStatic({ root: "./" }));
  app.use("/assets/*", serveStatic({ root: CLIENT_DIST }));
  app.use("/img/*", serveStatic({ root: CLIENT_DIST }));
  app.use("/favicons/*", serveStatic({ root: CLIENT_DIST }));

  // Dynamic PWA manifest
  app.get("/site.webmanifest", (c) => {
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
    const ownerRecord = db.select().from(schema.owner).get();
    const settings = getSiteSettings();
    const blogTitle = settings.blog_title ?? ownerRecord?.blogTitle ?? "zlog";
    const blogDesc =
      (settings.seo_description?.trim() ? settings.seo_description : null) ??
      ownerRecord?.blogDescription ??
      "A personal blog powered by zlog";

    const themeColorRow = db
      .select()
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.key, "header_bg_color_dark"))
      .get();
    const themeColor = themeColorRow?.value ?? "#6C5CE7";

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

  // Mount Routes
  app.route("/api/auth", auth);
  app.route("/api/posts", postsRoute);
  app.route("/api/categories", categoriesRoute);
  app.route("/api", commentsRoute);
  app.route("/api", settingsRoute);
  app.route("/api/federation", federationRoute);
  app.route("/api/oauth", oauthRoute);
  app.route("/api/analytics", analyticsRoute);
  app.route("/api/upload", uploadRoute);

  app.get("/api/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Robots.txt
  app.get("/robots.txt", (c) => {
    const settings = getSiteSettings();
    const siteUrl = (
      settings.canonical_url ??
      process.env.SITE_URL ??
      "http://localhost:3000"
    ).replace(/\/$/, "");
    return c.text(`User-agent: *
Allow: /

Disallow: /api/
Disallow: /assets/
Disallow: /favicons/
Disallow: /sw.js
Disallow: /site.webmanifest

Sitemap: ${siteUrl}/sitemap.xml`);
  });

  // Sitemap
  app.get("/sitemap.xml", (c) => {
    const settings = getSiteSettings();
    const siteUrl = (
      settings.canonical_url ??
      process.env.SITE_URL ??
      "http://localhost:3000"
    ).replace(/\/$/, "");
    c.header("Content-Type", "application/xml");
    return c.body(getSitemap(siteUrl));
  });

  // RSS Feed (Full)
  app.get("/rss.xml", (c) => {
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
    const settings = getSiteSettings();
    const xml = getRssFeed(siteUrl, settings);
    c.header("Content-Type", "application/rss+xml; charset=utf-8");
    return c.body(xml);
  });

  // RSS Feed (Category)
  app.get("/category/:slug/rss.xml", (c) => {
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
    const slug = c.req.param("slug");
    const settings = getSiteSettings();
    const xml = getCategoryRssFeed(siteUrl, slug, settings);
    if (!xml) {
      c.header("Content-Type", "application/rss+xml; charset=utf-8");
      return c.body(
        `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Not Found</title></channel></rss>`,
      );
    }
    c.header("Content-Type", "application/rss+xml; charset=utf-8");
    return c.body(xml);
  });

  // OpenAPI Documentation (Dev only)
  if (process.env.NODE_ENV !== "production") {
    app.doc("/doc", {
      openapi: "3.0.0",
      info: {
        version: "1.0.0",
        title: "ZLog API",
        description: "API Documentation for ZLog Blog Platform",
      },
    });

    app.get(
      "/reference",
      // eslint-disable-next-line @typescript-eslint/no-deprecated, @typescript-eslint/no-unsafe-argument
      apiReference({
        spec: {
          url: "/doc",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any),
    );
  }

  // SSR Fallback (Must be last)
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
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
    const url = new URL(c.req.url);
    const pathname = url.pathname;

    const html = handleSsr(pathname, url, indexHtmlTemplate, settings, siteUrl);
    return c.html(html);
  });

  app.onError(errorHandler);

  app.notFound((c) => {
    // If it's an API request, return JSON
    if (c.req.path.startsWith("/api/")) {
      return c.json({ success: false, error: { code: "NOT_FOUND", message: "Not Found" } }, 404);
    }
    // Otherwise let the SSR handler pick it up (though wildcard handles it usually)
    return c.text("Not Found", 404);
  });

  return app;
}
