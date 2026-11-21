import { describe, it, expect, beforeAll } from "vitest";
import { createApp } from "../app.js";
import {
  seedTestAdmin,
  seedDefaultSettings,
  getAuthToken,
  cleanDb,
  type TestAdmin,
} from "./helpers.js";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";

describe("Settings & Profile API", () => {
  const app = createApp();
  let admin: TestAdmin;
  let token: string;

  beforeAll(async () => {
    cleanDb();
    admin = seedTestAdmin();
    seedDefaultSettings();
    token = await getAuthToken(admin.id);
  });

  describe("GET /api/profile", () => {
    it("should return public profile without email when unauthenticated", async () => {
      const res = await app.request("/api/profile");
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        email?: string;
        socialLinks: unknown[];
        stats: { totalPosts: number; totalCategories: number; totalViews: number };
      };
      expect(data.email).toBeUndefined();
      expect(data).not.toHaveProperty("passwordHash");
      expect(data.socialLinks).toBeDefined();
      expect(data.stats).toBeDefined();
      expect(data.stats.totalPosts).toBe(0);
    });

    it("should include email when authenticated as admin", async () => {
      const res = await app.request("/api/profile", {
        headers: { Cookie: `zlog_token=${token}` },
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { email?: string };
      expect(data.email).toBe(admin.email);
    });
  });

  describe("PUT /api/profile", () => {
    it("should update profile fields", async () => {
      const res = await app.request("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: `zlog_token=${token}`,
        },
        body: JSON.stringify({
          displayName: "Updated Name",
          bio: "New bio",
        }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { displayName: string; bio: string };
      expect(data.displayName).toBe("Updated Name");
      expect(data.bio).toBe("New bio");
    });

    it("should sync blogTitle to siteSettings", async () => {
      await app.request("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: `zlog_token=${token}`,
        },
        body: JSON.stringify({ blogTitle: "My New Blog" }),
      });

      const setting = db
        .select()
        .from(schema.siteSettings)
        .where(eq(schema.siteSettings.key, "blog_title"))
        .get();
      expect(setting?.value).toBe("My New Blog");
    });

    it("should return 401 without auth", async () => {
      const res = await app.request("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "Hacker" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("Social Links", () => {
    it("GET /api/profile/social-links should return links", async () => {
      const res = await app.request("/api/profile/social-links");
      expect(res.status).toBe(200);
      const data = (await res.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
    });

    it("PUT /api/profile/social-links should replace all links", async () => {
      const res = await app.request("/api/profile/social-links", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: `zlog_token=${token}`,
        },
        body: JSON.stringify({
          links: [
            { platform: "github", url: "https://github.com/test" },
            { platform: "twitter", url: "https://twitter.com/test" },
          ],
        }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { platform: string }[];
      expect(data).toHaveLength(2);

      // Replace with just one link
      const res2 = await app.request("/api/profile/social-links", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: `zlog_token=${token}`,
        },
        body: JSON.stringify({
          links: [{ platform: "github", url: "https://github.com/newtest" }],
        }),
      });
      const data2 = (await res2.json()) as { platform: string }[];
      expect(data2).toHaveLength(1);
    });
  });

  describe("PUT /api/profile/account", () => {
    it("should change email with correct current password", async () => {
      const res = await app.request("/api/profile/account", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: `zlog_token=${token}`,
        },
        body: JSON.stringify({
          email: "newemail@test.com",
          currentPassword: admin.password,
        }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { email: string };
      expect(data.email).toBe("newemail@test.com");

      // Restore email
      db.update(schema.owner)
        .set({ email: admin.email })
        .where(eq(schema.owner.id, admin.id))
        .run();
    });

    it("should return 401 with wrong current password", async () => {
      const res = await app.request("/api/profile/account", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: `zlog_token=${token}`,
        },
        body: JSON.stringify({
          email: "new@test.com",
          currentPassword: "wrongpassword",
        }),
      });
      expect(res.status).toBe(401);
    });

    it("should return 400 for short new password", async () => {
      const res = await app.request("/api/profile/account", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: `zlog_token=${token}`,
        },
        body: JSON.stringify({
          currentPassword: admin.password,
          newPassword: "short",
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("Site Settings", () => {
    it("GET /api/settings should return settings map", async () => {
      const res = await app.request("/api/settings");
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, string>;
      expect(data.posts_per_page).toBeDefined();
    });

    it("PUT /api/settings should update settings", async () => {
      const res = await app.request("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: `zlog_token=${token}`,
        },
        body: JSON.stringify({ posts_per_page: "20", default_language: "ko" }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, string>;
      expect(data.posts_per_page).toBe("20");
      expect(data.default_language).toBe("ko");

      // Restore
      db.update(schema.siteSettings)
        .set({ value: "10" })
        .where(eq(schema.siteSettings.key, "posts_per_page"))
        .run();
    });

    it("PUT /api/settings should return 401 without auth", async () => {
      const res = await app.request("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test_key: "value" }),
      });
      expect(res.status).toBe(401);
    });

    it("should hide notification_slack_webhook from unauthenticated GET /api/settings", async () => {
      const putRes = await app.request("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: `zlog_token=${token}`,
        },
        body: JSON.stringify({
          notification_slack_webhook: "https://hooks.slack.com/services/T000/B000/XXXX",
        }),
      });
      expect(putRes.status).toBe(200);

      const publicRes = await app.request("/api/settings");
      expect(publicRes.status).toBe(200);
      const publicData = (await publicRes.json()) as Record<string, string>;
      expect(publicData.notification_slack_webhook).toBeUndefined();

      const adminRes = await app.request("/api/settings", {
        headers: { Cookie: `zlog_token=${token}` },
      });
      const adminData = (await adminRes.json()) as Record<string, string>;
      expect(adminData.notification_slack_webhook).toBe(
        "https://hooks.slack.com/services/T000/B000/XXXX",
      );
    });

    it("should reject non-Slack webhook URLs on PUT /api/settings and POST /api/settings/test-slack", async () => {
      const badPut = await app.request("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: `zlog_token=${token}`,
        },
        body: JSON.stringify({
          notification_slack_webhook: "http://169.254.169.254/latest/meta-data/",
        }),
      });
      expect(badPut.status).toBe(400);

      // Even if a legacy non-Slack URL exists in DB, test-slack refuses to send outbound requests to it
      db.update(schema.siteSettings)
        .set({ value: "https://evil.example.com/hook" })
        .where(eq(schema.siteSettings.key, "notification_slack_webhook"))
        .run();

      const badTest = await app.request("/api/settings/test-slack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `zlog_token=${token}`,
        },
      });
      expect(badTest.status).toBe(400);
    });

    it("should persist all 6 theme color settings keys", async () => {
      const themePayload = {
        primary_color: "#112233",
        accent_color: "#445566",
        surface_color_light: "#fafafa",
        surface_color_dark: "#121212",
        text_color_light: "#222222",
        text_color_dark: "#eeeeee",
      };
      const res = await app.request("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: `zlog_token=${token}`,
        },
        body: JSON.stringify(themePayload),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, string>;
      expect(data).toMatchObject(themePayload);
    });
  });
});
