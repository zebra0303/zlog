import type * as schema from "../db/schema.js";

// Hono context variables set by authMiddleware
export type AppVariables = {
  owner: typeof schema.owner.$inferSelect;
  ownerId: string;
};
