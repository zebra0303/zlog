import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createApp } from "../app.js";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { createToken } from "../middleware/auth.js";
import { generateId } from "../lib/uuid.js";
import { seedTestAdmin, cleanDb } from "./helpers.js";

describe("Secret Categories API", () => {
  const app = createApp();
  let adminToken: string;
  let publicCatId: string;
  let secretCatId: string;

  beforeAll(async () => {
    cleanDb();
    // 1. Create a fake admin user
    const admin = seedTestAdmin();
    adminToken = await createToken(admin.id);

    // 2. Create public category
    publicCatId = generateId();
    db.insert(schema.categories)
      .values({
        id: publicCatId,
        name: "Public Cat",
        slug: "public-cat",
        isPublic: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();

    // 3. Create secret category
    secretCatId = generateId();
    db.insert(schema.categories)
      .values({
        id: secretCatId,
        name: "Secret Cat",
        slug: "secret-cat",
        isPublic: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();

    // 4. Create public post
    db.insert(schema.posts)
      .values({
        id: generateId(),
        title: "Public Post",
        slug: "public-post",
        content: "test",
        categoryId: publicCatId,
        status: "published",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();

    // 5. Create secret post
    db.insert(schema.posts)
      .values({
        id: generateId(),
        title: "Secret Post",
        slug: "secret-post",
        content: "test",
        categoryId: secretCatId,
        status: "published",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();
  });

  afterAll(() => {
    cleanDb();
  });

  it("should hide secret categories for guests", async () => {
    const res = await app.request("/api/categories");
    const json = (await res.json()) as { slug: string }[];
    expect(json.find((c) => c.slug === "secret-cat")).toBeUndefined();
    expect(json.find((c) => c.slug === "public-cat")).toBeDefined();
  });

  it("should show secret categories for admins", async () => {
    const res = await app.request("/api/categories", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const json = (await res.json()) as { slug: string }[];
    expect(json.find((c) => c.slug === "secret-cat")).toBeDefined();
  });

  it("should hide secret posts for guests", async () => {
    const res = await app.request("/api/posts?status=published");
    const json = (await res.json()) as { items: { slug: string }[] };
    expect(json.items.find((p) => p.slug === "secret-post")).toBeUndefined();
    expect(json.items.find((p) => p.slug === "public-post")).toBeDefined();
  });

  it("should show secret posts for admins", async () => {
    const res = await app.request("/api/posts?status=published", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const json = (await res.json()) as { items: { slug: string }[] };
    expect(json.items.find((p) => p.slug === "secret-post")).toBeDefined();
  });

  it("should return 404 for secret post single view as guest", async () => {
    const res = await app.request("/api/posts/secret-post");
    expect(res.status).toBe(404);
  });

  it("should return 200 for secret post single view as admin", async () => {
    const res = await app.request("/api/posts/secret-post", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
  });
});
