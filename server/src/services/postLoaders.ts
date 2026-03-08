import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, inArray, isNull, and, sql } from "drizzle-orm";

export function batchLoadCategories(categoryIds: string[]) {
  const map = new Map<string, { id: string; name: string; slug: string }>();
  if (categoryIds.length === 0) return map;
  const rows = db
    .select({
      id: schema.categories.id,
      name: schema.categories.name,
      slug: schema.categories.slug,
    })
    .from(schema.categories)
    .where(inArray(schema.categories.id, categoryIds))
    .all();
  for (const r of rows) map.set(r.id, r);
  return map;
}

export function batchLoadCommentCounts(postIds: string[]) {
  const map = new Map<string, number>();
  if (postIds.length === 0) return map;
  const rows = db
    .select({ postId: schema.comments.postId, count: sql<number>`count(*)` })
    .from(schema.comments)
    .where(and(inArray(schema.comments.postId, postIds), isNull(schema.comments.deletedAt)))
    .groupBy(schema.comments.postId)
    .all();
  for (const r of rows) map.set(r.postId, r.count);
  return map;
}

export function batchLoadLikeCounts(postIds: string[]) {
  const map = new Map<string, number>();
  if (postIds.length === 0) return map;
  const rows = db
    .select({ postId: schema.postLikes.postId, count: sql<number>`count(*)` })
    .from(schema.postLikes)
    .where(inArray(schema.postLikes.postId, postIds))
    .groupBy(schema.postLikes.postId)
    .all();
  for (const r of rows) map.set(r.postId, r.count);
  return map;
}

export function batchLoadTags(postIds: string[]) {
  const map = new Map<string, { id: string; name: string; slug: string }[]>();
  if (postIds.length === 0) return map;
  const rows = db
    .select({
      postId: schema.postTags.postId,
      id: schema.tags.id,
      name: schema.tags.name,
      slug: schema.tags.slug,
    })
    .from(schema.postTags)
    .innerJoin(schema.tags, eq(schema.postTags.tagId, schema.tags.id))
    .where(inArray(schema.postTags.postId, postIds))
    .all();
  for (const r of rows) {
    const arr = map.get(r.postId) ?? [];
    arr.push({ id: r.id, name: r.name, slug: r.slug });
    map.set(r.postId, arr);
  }
  return map;
}
