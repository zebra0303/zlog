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
    it("should return profile with stats and social links", async () => {
      const res = await app.request("/api/profile");
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        email: string;
        socialLinks: unknown[];
        stats: { totalPosts: number; totalCategories: number; totalViews: number };
      };
      expect(data.email).toBe(admin.email);
      expect(data).not.toHaveProperty("passwordHash");
      expect(data.socialLinks).toBeDefined();
      expect(data.stats).toBeDefined();
      expect(data.stats.totalPosts).toBe(0);
    });
  });

  describe("PUT /api/profile", () => {
    it("should update profile fields", async () => {
      const res = await app.request("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
          Authorization: `Bearer ${token}`,
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
          Authorization: `Bearer ${token}`,
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
          Authorization: `Bearer ${token}`,
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
          Authorization: `Bearer ${token}`,
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
          Authorization: `Bearer ${token}`,
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
          Authorization: `Bearer ${token}`,
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ posts_per_page: "20", custom_setting: "value" }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, string>;
      expect(data.posts_per_page).toBe("20");
      expect(data.custom_setting).toBe("value");

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
  });
});
