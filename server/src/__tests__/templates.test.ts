import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createApp } from "../app.js";
import { createToken } from "../middleware/auth.js";
import { seedTestAdmin, cleanDb } from "./helpers.js";
import type { PostTemplate } from "@zlog/shared";

describe("Post Templates API", () => {
  const app = createApp();
  let adminToken: string;

  beforeAll(async () => {
    cleanDb();
    const admin = seedTestAdmin();
    adminToken = await createToken(admin.id);
  });

  afterAll(() => {
    cleanDb();
  });

  it("should create a new template", async () => {
    const res = await app.request("/api/templates", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "My Template",
        content: "# Template Content",
      }),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as PostTemplate;
    expect(json.name).toBe("My Template");
    expect(json.content).toBe("# Template Content");
  });

  it("should list templates", async () => {
    const res = await app.request("/api/templates", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as PostTemplate[];
    expect(json.length).toBe(1);
    const first = json[0];
    expect(first).toBeDefined();
    expect(first?.name).toBe("My Template");
  });

  it("should update a template", async () => {
    const listRes = await app.request("/api/templates", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const templates = (await listRes.json()) as PostTemplate[];
    expect(templates[0]).toBeDefined();
    const templateId = templates[0]?.id;

    const res = await app.request(`/api/templates/${templateId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Updated Name",
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as PostTemplate;
    expect(json.name).toBe("Updated Name");
    expect(json.content).toBe("# Template Content");
  });

  it("should delete a template", async () => {
    const listRes = await app.request("/api/templates", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const templates = (await listRes.json()) as PostTemplate[];
    expect(templates[0]).toBeDefined();
    const templateId = templates[0]?.id;

    const res = await app.request(`/api/templates/${templateId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);

    const listRes2 = await app.request("/api/templates", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const templates2 = (await listRes2.json()) as PostTemplate[];
    expect(templates2.length).toBe(0);
  });

  it("should deny access to guests", async () => {
    const res = await app.request("/api/templates");
    expect(res.status).toBe(401);
  });
});
