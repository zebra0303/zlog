import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createApp } from "../app.js";
import {
  seedTestAdmin,
  seedDefaultSettings,
  getAuthToken,
  createTestPost,
  createTestComment,
  cleanDb,
  type TestAdmin,
} from "./helpers.js";
import { db, sqlite } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";

describe("Comments API", () => {
  const app = createApp();
  let admin: TestAdmin;
  let token: string;

  beforeAll(async () => {
    cleanDb();
    admin = seedTestAdmin();
    seedDefaultSettings();
    token = await getAuthToken(admin.id);
  });

  beforeEach(() => {
    sqlite.exec(
      "DELETE FROM comment_likes; DELETE FROM comments; DELETE FROM post_tags; DELETE FROM tags; DELETE FROM posts; DELETE FROM categories;",
    );
  });

  describe("GET /api/posts/:postId/comments", () => {
    it("should return empty array when no comments", async () => {
      const post = createTestPost();
      const res = await app.request(`/api/posts/${post.id}/comments`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as unknown[];
      expect(data).toEqual([]);
    });

    it("should return comment tree structure", async () => {
      const post = createTestPost();
      const parent = createTestComment(post.id, { authorName: "Parent" });
      createTestComment(post.id, { authorName: "Reply", parentId: parent.id });

      const res = await app.request(`/api/posts/${post.id}/comments`);
      const data = (await res.json()) as { authorName: string; replies: unknown[] }[];
      expect(data).toHaveLength(1);
      const first = data[0];
      expect(first).toBeDefined();
      expect(first?.authorName).toBe("Parent");
      expect(first?.replies).toHaveLength(1);
    });
  });

  describe("POST /api/posts/:postId/comments", () => {
    it("should create anonymous comment with password", async () => {
      const post = createTestPost();
      const res = await app.request(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: "Anonymous User",
          authorEmail: "anon@test.com",
          content: "Hello world",
          password: "secret123",
        }),
      });
      expect(res.status).toBe(201);
      const data = (await res.json()) as {
        authorName: string;
        hasPassword: boolean;
        content: string;
      };
      expect(data.authorName).toBe("Anonymous User");
      expect(data.hasPassword).toBe(true);
    });

    it("should return 400 for anonymous comment without password", async () => {
      const post = createTestPost();
      const res = await app.request(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: "User",
          authorEmail: "user@test.com",
          content: "No password",
        }),
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 when content exceeds 2000 characters", async () => {
      const post = createTestPost();
      const res = await app.request(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: "User",
          authorEmail: "user@test.com",
          content: "x".repeat(2001),
          password: "pass123",
        }),
      });
      expect(res.status).toBe(400);
    });

    it("should return 404 on draft post", async () => {
      const post = createTestPost({ status: "draft" });
      const res = await app.request(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: "User",
          authorEmail: "user@test.com",
          content: "Test",
          password: "pass123",
        }),
      });
      expect(res.status).toBe(404);
    });

    it("should return 403 when comments are disabled", async () => {
      db.update(schema.siteSettings)
        .set({ value: "disabled" })
        .where(eq(schema.siteSettings.key, "comment_mode"))
        .run();

      const post = createTestPost();
      const res = await app.request(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: "User",
          authorEmail: "user@test.com",
          content: "Test",
          password: "pass123",
        }),
      });
      expect(res.status).toBe(403);

      // Restore
      db.update(schema.siteSettings)
        .set({ value: "both" })
        .where(eq(schema.siteSettings.key, "comment_mode"))
        .run();
    });

    it("should sanitize XSS content", async () => {
      const post = createTestPost();
      const res = await app.request(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: "User",
          authorEmail: "user@test.com",
          content: '<script>alert("xss")</script>Hello',
          password: "pass123",
        }),
      });
      expect(res.status).toBe(201);
      const data = (await res.json()) as { content: string };
      expect(data.content).not.toContain("<script>");
    });
  });

  describe("PUT /api/comments/:id", () => {
    it("should update comment with correct password", async () => {
      const post = createTestPost();
      const comment = createTestComment(post.id);

      const res = await app.request(`/api/comments/${comment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "Updated content",
          password: "commentpass",
        }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { content: string; isEdited: boolean };
      expect(data.content).toContain("Updated content");
      expect(data.isEdited).toBe(true);
    });

    it("should return 403 with wrong password", async () => {
      const post = createTestPost();
      const comment = createTestComment(post.id);

      const res = await app.request(`/api/comments/${comment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "Updated",
          password: "wrongpassword",
        }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/comments/:id", () => {
    it("should allow admin to delete any comment", async () => {
      const post = createTestPost();
      const comment = createTestComment(post.id);

      const res = await app.request(`/api/comments/${comment.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
    });

    it("should allow anonymous user to delete with correct password", async () => {
      const post = createTestPost();
      const comment = createTestComment(post.id);

      const res = await app.request(`/api/comments/${comment.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "commentpass" }),
      });
      expect(res.status).toBe(200);
    });

    it("should return 403 with wrong password", async () => {
      const post = createTestPost();
      const comment = createTestComment(post.id);

      const res = await app.request(`/api/comments/${comment.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrongpass" }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/comments/:id/like", () => {
    it("should toggle like on", async () => {
      const post = createTestPost();
      const comment = createTestComment(post.id);

      const res = await app.request(`/api/comments/${comment.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: "visitor-1" }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { liked: boolean };
      expect(data.liked).toBe(true);
    });

    it("should toggle like off on second call", async () => {
      const post = createTestPost();
      const comment = createTestComment(post.id);

      await app.request(`/api/comments/${comment.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: "visitor-2" }),
      });

      const res = await app.request(`/api/comments/${comment.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: "visitor-2" }),
      });
      const data = (await res.json()) as { liked: boolean };
      expect(data.liked).toBe(false);
    });

    it("should return 400 without visitorId", async () => {
      const post = createTestPost();
      const comment = createTestComment(post.id);

      const res = await app.request(`/api/comments/${comment.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });
});
