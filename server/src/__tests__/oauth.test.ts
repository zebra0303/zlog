import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createApp } from "../app.js";
import { cleanDb, seedDefaultSettings } from "./helpers.js";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateId } from "../lib/uuid.js";

describe("OAuth API", () => {
  const app = createApp();

  beforeAll(() => {
    cleanDb();
    seedDefaultSettings();
  });

  afterAll(() => {
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
  });

  describe("GET /api/oauth/providers", () => {
    it("should return false for all providers if no env vars are set", async () => {
      const res = await app.request("/api/oauth/providers");
      const data = (await res.json()) as { github: boolean; google: boolean };
      expect(data.github).toBe(false);
      expect(data.google).toBe(false);
    });

    it("should return true for GitHub when GITHUB_CLIENT_ID is set", async () => {
      process.env.GITHUB_CLIENT_ID = "test-github-id";
      const res = await app.request("/api/oauth/providers");
      const data = (await res.json()) as { github: boolean; google: boolean };
      expect(data.github).toBe(true);
      expect(data.google).toBe(false);
      delete process.env.GITHUB_CLIENT_ID;
    });

    it("should return true for Google when GOOGLE_CLIENT_ID is set", async () => {
      process.env.GOOGLE_CLIENT_ID = "test-google-id";
      const res = await app.request("/api/oauth/providers");
      const data = (await res.json()) as { github: boolean; google: boolean };
      expect(data.github).toBe(false);
      expect(data.google).toBe(true);
      delete process.env.GOOGLE_CLIENT_ID;
    });
  });

  describe("GET /api/oauth/{provider}", () => {
    it("should redirect to GitHub authorization URL", async () => {
      process.env.GITHUB_CLIENT_ID = "test-github-client-id";
      process.env.SITE_URL = "http://localhost:3000";

      const res = await app.request("/api/oauth/github");
      expect(res.status).toBe(302);
      const location = res.headers.get("Location");
      expect(location).toContain("https://github.com/login/oauth/authorize");
      expect(location).toContain("client_id=test-github-client-id");
      expect(location).toContain(
        "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Foauth%2Fgithub%2Fcallback",
      );

      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.SITE_URL;
    });

    it("should redirect to Google authorization URL", async () => {
      process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
      process.env.SITE_URL = "http://localhost:3000";

      const res = await app.request("/api/oauth/google");
      expect(res.status).toBe(302);
      const location = res.headers.get("Location");
      expect(location).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(location).toContain("client_id=test-google-client-id");
      expect(location).toContain(
        "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Foauth%2Fgoogle%2Fcallback",
      );

      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.SITE_URL;
    });
  });

  describe("GET /api/oauth/{provider}/callback", () => {
    it("should handle GitHub callback, create commenter, and redirect", async () => {
      process.env.GITHUB_CLIENT_ID = "gh-id";
      process.env.GITHUB_CLIENT_SECRET = "gh-secret";
      process.env.SITE_URL = "http://localhost:3000";

      const fetchSpy = vi.fn();
      fetchSpy
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "test-gh-token" }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 12345,
              login: "gh-user",
              name: "GitHub User",
              avatar_url: "https://github.com/avatar.png",
              html_url: "https://github.com/gh-user",
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([{ email: "gh-user@example.com", primary: true, verified: true }]),
            { status: 200 },
          ),
        );
      vi.stubGlobal("fetch", fetchSpy);

      const res = await app.request("/api/oauth/github/callback?code=test-code");
      expect(res.status).toBe(302);
      const location = res.headers.get("Location");
      expect(location).toContain("/oauth-callback");

      const commenter = db
        .select()
        .from(schema.commenters)
        .where(eq(schema.commenters.providerId, "12345"))
        .get();
      expect(commenter).toBeDefined();
      expect(commenter?.displayName).toBe("GitHub User");
      expect(commenter?.email).toBe("gh-user@example.com");

      vi.unstubAllGlobals();
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_SECRET;
      delete process.env.SITE_URL;
    });

    it("should handle Google callback, create commenter, and redirect", async () => {
      process.env.GOOGLE_CLIENT_ID = "gg-id";
      process.env.GOOGLE_CLIENT_SECRET = "gg-secret";
      process.env.SITE_URL = "http://localhost:3000";

      const fetchSpy = vi.fn();
      fetchSpy
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "test-gg-token" }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: "54321",
              name: "Google User",
              email: "google-user@example.com",
              picture: "https://google.com/avatar.png",
            }),
            { status: 200 },
          ),
        );
      vi.stubGlobal("fetch", fetchSpy);

      const res = await app.request("/api/oauth/google/callback?code=test-code");
      expect(res.status).toBe(302);
      const location = res.headers.get("Location");
      expect(location).toContain("/oauth-callback");

      const commenter = db
        .select()
        .from(schema.commenters)
        .where(eq(schema.commenters.providerId, "54321"))
        .get();
      expect(commenter).toBeDefined();
      expect(commenter?.displayName).toBe("Google User");
      expect(commenter?.email).toBe("google-user@example.com");

      vi.unstubAllGlobals();
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      delete process.env.SITE_URL;
    });
  });

  describe("GET /api/oauth/commenter/:id", () => {
    it("should return commenter data for a valid ID", async () => {
      const commenterId = generateId();
      db.insert(schema.commenters)
        .values({
          id: commenterId,
          provider: "github",
          providerId: "test-user-123",
          displayName: "Test User",
          email: "test@example.com",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .run();

      const res = await app.request(`/api/oauth/commenter/${commenterId}`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { displayName: string };
      expect(data.displayName).toBe("Test User");
    });

    it("should return 404 for a non-existent commenter ID", async () => {
      const res = await app.request(`/api/oauth/commenter/non-existent-id`);
      expect(res.status).toBe(404);
    });
  });
});
