import { Hono } from "hono";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { generateId } from "../lib/uuid.js";

const oauthRoute = new Hono();

// ============ GitHub OAuth ============
oauthRoute.get("/github", (c) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return c.json({ error: "GitHub OAuth is not configured." }, 500);

  const redirectUri = `${process.env.SITE_URL ?? "http://localhost:3000"}/api/oauth/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user user:email`;
  return c.redirect(url);
});

oauthRoute.get("/github/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.json({ error: "Authorization code is missing." }, 400);

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return c.json({ error: "GitHub OAuth is not configured." }, 500);

  const redirectUri = `${process.env.SITE_URL ?? "http://localhost:3000"}/api/oauth/github/callback`;

  // Issue access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) return c.json({ error: "Failed to issue token." }, 400);

  // Fetch user info
  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
  });
  const user = (await userRes.json()) as {
    id: number;
    login: string;
    name?: string;
    avatar_url?: string;
    email?: string;
    html_url?: string;
  };

  // If email is not available, fetch via separate API
  let email = user.email;
  if (!email) {
    try {
      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
      });
      const emails = (await emailRes.json()) as {
        email: string;
        primary: boolean;
        verified: boolean;
      }[];
      email = emails.find((e) => e.primary && e.verified)?.email ?? emails[0]?.email ?? undefined;
    } catch {
      // ignore
    }
  }

  const providerId = String(user.id);
  const displayName = user.name ?? user.login;
  const avatarUrl = user.avatar_url ?? null;
  const profileUrl = user.html_url ?? null;

  // commenter upsert
  const commenter = upsertCommenter(
    "github",
    providerId,
    displayName,
    email ?? null,
    avatarUrl,
    profileUrl,
  );

  // Redirect to client (pass commenter info as query parameters)
  const params = new URLSearchParams({
    commenterId: commenter.id,
    displayName: commenter.displayName,
    avatarUrl: commenter.avatarUrl ?? "",
    provider: "github",
  });
  return c.redirect(`/oauth-callback?${params.toString()}`);
});

// ============ Google OAuth ============
oauthRoute.get("/google", (c) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return c.json({ error: "Google OAuth is not configured." }, 500);

  const redirectUri = `${process.env.SITE_URL ?? "http://localhost:3000"}/api/oauth/google/callback`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("openid email profile")}&access_type=offline`;
  return c.redirect(url);
});

oauthRoute.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.json({ error: "Authorization code is missing." }, 400);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return c.json({ error: "Google OAuth is not configured." }, 500);

  const redirectUri = `${process.env.SITE_URL ?? "http://localhost:3000"}/api/oauth/google/callback`;

  // Issue access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) return c.json({ error: "Failed to issue token." }, 400);

  // Fetch user info
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const user = (await userRes.json()) as {
    id: string;
    name?: string;
    email?: string;
    picture?: string;
  };

  const providerId = user.id;
  const displayName = user.name ?? "Google User";
  const email = user.email ?? null;
  const avatarUrl = user.picture ?? null;

  const commenter = upsertCommenter("google", providerId, displayName, email, avatarUrl, null);

  const params = new URLSearchParams({
    commenterId: commenter.id,
    displayName: commenter.displayName,
    avatarUrl: commenter.avatarUrl ?? "",
    provider: "google",
  });
  return c.redirect(`/oauth-callback?${params.toString()}`);
});

// ============ Get current commenter info ============
oauthRoute.get("/commenter/:id", (c) => {
  const id = c.req.param("id");
  const commenter = db.select().from(schema.commenters).where(eq(schema.commenters.id, id)).get();
  if (!commenter) return c.json({ error: "Not found." }, 404);
  return c.json(commenter);
});

// ============ Check which OAuth providers are enabled ============
oauthRoute.get("/providers", (c) => {
  return c.json({
    github: !!process.env.GITHUB_CLIENT_ID,
    google: !!process.env.GOOGLE_CLIENT_ID,
  });
});

// ============ Helper ============
function upsertCommenter(
  provider: "github" | "google",
  providerId: string,
  displayName: string,
  email: string | null,
  avatarUrl: string | null,
  profileUrl: string | null,
) {
  const now = new Date().toISOString();
  const existing = db
    .select()
    .from(schema.commenters)
    .where(
      and(eq(schema.commenters.provider, provider), eq(schema.commenters.providerId, providerId)),
    )
    .get();

  if (existing) {
    db.update(schema.commenters)
      .set({ displayName, email, avatarUrl, profileUrl, updatedAt: now })
      .where(eq(schema.commenters.id, existing.id))
      .run();
    return { ...existing, displayName, email, avatarUrl, profileUrl, updatedAt: now };
  }

  const id = generateId();
  db.insert(schema.commenters)
    .values({
      id,
      provider,
      providerId,
      displayName,
      email,
      avatarUrl,
      profileUrl,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return {
    id,
    provider,
    providerId,
    displayName,
    email,
    avatarUrl,
    profileUrl,
    createdAt: now,
    updatedAt: now,
  };
}

export default oauthRoute;
