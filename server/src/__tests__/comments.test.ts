import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from "vitest";
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
import { generateId } from "../lib/uuid.js";

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
      const data = (await res.json()) as { items: unknown[] };
      expect(data.items).toEqual([]);
    });

    it("should return comment tree structure", async () => {
      const post = createTestPost();
      const parent = createTestComment(post.id, { authorName: "Parent" });
      createTestComment(post.id, { authorName: "Reply", parentId: parent.id });

      const res = await app.request(`/api/posts/${post.id}/comments`);
      const data = (await res.json()) as { items: { authorName: string; replies: unknown[] }[] };
      expect(data.items).toHaveLength(1);
      const first = data.items[0];
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

  describe("Slack notification on comment creation", () => {
    // Shared spy — created fresh before each test via vi.stubGlobal to avoid cross-test contamination
    let fetchSpy: ReturnType<typeof vi.fn>;

    function setSlackWebhook(url: string) {
      const existing = db
        .select()
        .from(schema.siteSettings)
        .where(eq(schema.siteSettings.key, "notification_slack_webhook"))
        .get();
      if (existing) {
        db.update(schema.siteSettings)
          .set({ value: url })
          .where(eq(schema.siteSettings.key, "notification_slack_webhook"))
          .run();
      } else {
        db.insert(schema.siteSettings)
          .values({
            id: generateId(),
            key: "notification_slack_webhook",
            value: url,
            updatedAt: new Date().toISOString(),
          })
          .run();
      }
    }

    beforeEach(() => {
      // Use vi.stubGlobal so each test gets a completely fresh mock function
      fetchSpy = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
      vi.stubGlobal("fetch", fetchSpy);
      // Ensure webhook is empty at the start of each test
      setSlackWebhook("");
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("should call fetch with correct Slack payload when webhook is configured", async () => {
      setSlackWebhook("https://hooks.slack.com/services/test");

      const post = createTestPost();
      const res = await app.request(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: "Tester",
          authorEmail: "tester@test.com",
          content: "Hello Slack!",
          password: "pass123",
        }),
      });
      expect(res.status).toBe(201);

      // Allow fire-and-forget to run
      await new Promise((r) => setTimeout(r, 50));

      const slackCall = fetchSpy.mock.calls.find(([url]) => {
        try {
          const parsed = new URL(typeof url === "string" ? url : "");
          return parsed.hostname === "hooks.slack.com";
        } catch {
          return false;
        }
      });
      expect(slackCall).toBeDefined();
      if (!slackCall) throw new Error("Expected Slack call not found");
      const callOpts = slackCall[1] as { body: string };
      const body = JSON.parse(callOpts.body) as { text: string };
      expect(body.text).toContain("💬 새 댓글 알림");
      expect(body.text).toContain("Tester");
      expect(body.text).toContain("Hello Slack!");
    });

    it("should not call Slack fetch when webhook is empty", async () => {
      // webhook is "" (set by beforeEach)

      const post = createTestPost();
      const res = await app.request(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: "NoSlack",
          authorEmail: "noslack@test.com",
          content: "No webhook here",
          password: "pass123",
        }),
      });
      expect(res.status).toBe(201);

      await new Promise((r) => setTimeout(r, 50));

      const slackCall = fetchSpy.mock.calls.find(([url]) => {
        try {
          const parsed = new URL(typeof url === "string" ? url : "");
          return parsed.hostname === "hooks.slack.com";
        } catch {
          return false;
        }
      });
      expect(slackCall).toBeUndefined();
    });

    it("reply notification should include reply indicator in text", async () => {
      setSlackWebhook("https://hooks.slack.com/services/test");

      const post = createTestPost();
      const parent = createTestComment(post.id, { authorName: "Parent" });

      const res = await app.request(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: "Replier",
          authorEmail: "reply@test.com",
          content: "This is a reply",
          password: "pass123",
          parentId: parent.id,
        }),
      });
      expect(res.status).toBe(201);

      await new Promise((r) => setTimeout(r, 50));

      const slackCall = fetchSpy.mock.calls.find(([url]) => {
        try {
          const parsed = new URL(typeof url === "string" ? url : "");
          return parsed.hostname === "hooks.slack.com";
        } catch {
          return false;
        }
      });
      expect(slackCall).toBeDefined();
      if (!slackCall) throw new Error("Expected Slack call not found");
      const callOpts = slackCall[1] as { body: string };
      const body = JSON.parse(callOpts.body) as { text: string };
      expect(body.text).toContain("↩️ 새 답글 알림");
    });
  });

  describe("POST /api/settings/test-slack", () => {
    function upsertSlackWebhook(url: string) {
      const existing = db
        .select()
        .from(schema.siteSettings)
        .where(eq(schema.siteSettings.key, "notification_slack_webhook"))
        .get();
      if (existing) {
        db.update(schema.siteSettings)
          .set({ value: url })
          .where(eq(schema.siteSettings.key, "notification_slack_webhook"))
          .run();
      } else {
        db.insert(schema.siteSettings)
          .values({
            id: generateId(),
            key: "notification_slack_webhook",
            value: url,
            updatedAt: new Date().toISOString(),
          })
          .run();
      }
    }

    beforeEach(() => {
      vi.unstubAllGlobals();
      upsertSlackWebhook("");
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("should return 400 when no webhook URL is configured", async () => {
      const res = await app.request("/api/settings/test-slack", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(400);
    });

    it("should return 502 when Slack returns non-OK status", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("error", { status: 500 })));
      upsertSlackWebhook("https://hooks.slack.com/services/test");

      const res = await app.request("/api/settings/test-slack", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(502);
    });

    it("should return 200 on successful Slack test", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok", { status: 200 })));
      upsertSlackWebhook("https://hooks.slack.com/services/test");

      const res = await app.request("/api/settings/test-slack", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { ok: boolean };
      expect(data.ok).toBe(true);
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
