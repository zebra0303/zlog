import { Hono } from "hono";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { generateId } from "../lib/uuid.js";

const templatesRoute = new Hono();

templatesRoute.get("/", authMiddleware, (c) => {
  const templates = db
    .select()
    .from(schema.postTemplates)
    .orderBy(desc(schema.postTemplates.createdAt))
    .all();
  return c.json(templates);
});

templatesRoute.post("/", authMiddleware, async (c) => {
  const body = await c.req.json<{ name?: string; content?: string }>();
  if (!body.name || !body.content) {
    return c.json({ error: "Name and content are required" }, 400);
  }

  const id = generateId();
  const now = new Date().toISOString();

  db.insert(schema.postTemplates)
    .values({
      id,
      name: body.name,
      content: body.content,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const newTemplate = db
    .select()
    .from(schema.postTemplates)
    .where(eq(schema.postTemplates.id, id))
    .get();
  return c.json(newTemplate, 201);
});

templatesRoute.put("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; content?: string }>();

  const existing = db
    .select()
    .from(schema.postTemplates)
    .where(eq(schema.postTemplates.id, id))
    .get();
  if (!existing) {
    return c.json({ error: "Template not found" }, 404);
  }

  db.update(schema.postTemplates)
    .set({
      name: body.name ?? existing.name,
      content: body.content ?? existing.content,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.postTemplates.id, id))
    .run();

  const updated = db
    .select()
    .from(schema.postTemplates)
    .where(eq(schema.postTemplates.id, id))
    .get();
  return c.json(updated);
});

templatesRoute.delete("/:id", authMiddleware, (c) => {
  const id = c.req.param("id");
  db.delete(schema.postTemplates).where(eq(schema.postTemplates.id, id)).run();
  return c.json({ message: "Template deleted" });
});

export default templatesRoute;
