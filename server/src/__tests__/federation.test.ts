import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createApp } from "../app.js";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import {
  seedTestAdmin,
  seedDefaultSettings,
  createTestCategory,
  createTestRemoteBlog,
  createTestRemotePost,
  cleanDb,
} from "./helpers.js";
import { eq } from "drizzle-orm";

// Unmock syncService to test real implementation
vi.unmock("../services/syncService.js");
// We need to re-import it after unmocking
const { syncSubscription } = await import("../services/syncService.js");

describe("Federation & Sync Security", () => {
  const app = createApp();

  beforeAll(() => {
    cleanDb();
    seedTestAdmin();
    seedDefaultSettings();
  });

  beforeEach(() => {
    cleanDb();
    seedTestAdmin();
    seedDefaultSettings();
    vi.restoreAllMocks();
  });

  describe("Provider Side: Subscriber Validation", () => {
    it("should allow request when no identification header is provided (Public mode)", async () => {
      const cat = createTestCategory();
      const res = await app.request(`/api/federation/categories/${cat.id}/posts`);
      expect(res.status).toBe(200);
    });

    it("should allow request when a valid subscriber URL is provided in header", async () => {
      const cat = createTestCategory();
      const subUrl = "https://friend-blog.com";

      db.insert(schema.subscribers)
        .values({
          id: "sub-1",
          categoryId: cat.id,
          subscriberUrl: subUrl,
          callbackUrl: `${subUrl}/api/webhook`,
          isActive: true,
          createdAt: new Date().toISOString(),
        })
        .run();

      const res = await app.request(`/api/federation/categories/${cat.id}/posts`, {
        headers: { "X-Zlog-Subscriber-Url": subUrl },
      });
      expect(res.status).toBe(200);
    });

    it("should return 403 when subscriber is revoked (trailing slash normalization check)", async () => {
      const cat = createTestCategory();
      const subUrl = "https://former-friend.com";

      db.insert(schema.subscribers)
        .values({
          id: "sub-2",
          categoryId: cat.id,
          subscriberUrl: subUrl, // No slash in DB
          callbackUrl: `${subUrl}/api/webhook`,
          isActive: false,
          createdAt: new Date().toISOString(),
        })
        .run();

      const res = await app.request(`/api/federation/categories/${cat.id}/posts`, {
        headers: { "X-Zlog-Subscriber-Url": `${subUrl}/` }, // Slash in header
      });
      expect(res.status).toBe(403);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("ERR_SUBSCRIPTION_REVOKED");
    });
  });

  describe("Provider Side: Slack Notification", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchSpy = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
      vi.stubGlobal("fetch", fetchSpy);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("should send a slack notification when someone subscribes", async () => {
      const cat = createTestCategory();
      db.insert(schema.siteSettings)
        .values({
          id: "slack-webhook",
          key: "notification_slack_webhook",
          value: "https://hooks.slack.com/services/test",
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: schema.siteSettings.key,
          set: { value: "https://hooks.slack.com/services/test" },
        })
        .run();

      const res = await app.request("/api/federation/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: cat.id,
          subscriberUrl: "https://subscriber.com",
          callbackUrl: "https://subscriber.com/webhook",
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
      expect(body.text).toContain("🤝 새 Federation 구독자 알림");
      expect(body.text).toContain(cat.name);
      expect(body.text).toContain("https://subscriber.com");
    });
  });

  describe("Pull Side: Sync Revocation Handling", () => {
    it("should deactivate local subscription and mark posts unreachable on 403 response", async () => {
      const localCat = createTestCategory();
      const rb = createTestRemoteBlog({ siteUrl: "https://remote.com" });
      const rcId = "rc-1";
      db.insert(schema.remoteCategories)
        .values({
          id: rcId,
          remoteBlogId: rb.id,
          remoteId: "remote-cat-id",
          name: "Remote Cat",
          slug: "remote-cat",
          createdAt: new Date().toISOString(),
        })
        .run();

      const subId = "sub-local-1";
      db.insert(schema.categorySubscriptions)
        .values({
          id: subId,
          localCategoryId: localCat.id,
          remoteCategoryId: rcId,
          isActive: true,
          createdAt: new Date().toISOString(),
        })
        .run();

      const post = createTestRemotePost(rb.id, localCat.id, { remoteCategoryId: rcId });

      // Mock fetch to return 403
      const mockFetch = vi.fn().mockResolvedValue({
        status: 403,
        ok: false,
        json: () => Promise.resolve({ error: "ERR_SUBSCRIPTION_REVOKED" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const subRecord = db
        .select()
        .from(schema.categorySubscriptions)
        .where(eq(schema.categorySubscriptions.id, subId))
        .get();

      expect(subRecord).toBeDefined();
      if (subRecord) {
        await expect(syncSubscription(subRecord)).rejects.toThrow("ERR_SUBSCRIPTION_REVOKED");
      }

      const updatedSub = db
        .select()
        .from(schema.categorySubscriptions)
        .where(eq(schema.categorySubscriptions.id, subId))
        .get();
      expect(updatedSub?.isActive).toBe(false);

      const updatedPost = db
        .select()
        .from(schema.remotePosts)
        .where(eq(schema.remotePosts.id, post.id))
        .get();
      expect(updatedPost?.remoteStatus).toBe("unreachable");
    });
  });
});
