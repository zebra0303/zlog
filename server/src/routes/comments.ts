import { Hono } from "hono";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { generateId } from "../lib/uuid.js";

const commentsRoute = new Hono();

/**
 * HTML 태그 및 XSS 위험 요소 제거 — 평문 텍스트만 허용
 */
function sanitizePlainText(input: string): string {
  return input
    // HTML 태그 모두 제거
    .replace(/<[^>]*>/g, "")
    // HTML 엔티티 인코딩되지 않은 위험 문자 치환
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    // javascript: / data: URI 스킴 제거
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:/gi, "")
    // on* 이벤트 핸들러 패턴 제거
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

/**
 * URL 검증 — http/https만 허용
 */
function sanitizeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

function buildCommentTree(
  allComments: (typeof schema.comments.$inferSelect & {
    likeCount: number;
    isLikedByMe: boolean;
  })[],
  parentId: string | null = null,
  depth: number = 0,
): (typeof schema.comments.$inferSelect & {
  likeCount: number;
  isLikedByMe: boolean;
  replies: ReturnType<typeof buildCommentTree>;
})[] {
  if (depth >= 3) return [];
  return allComments
    .filter((c) => c.parentId === parentId)
    .map((comment) => ({
      ...comment,
      replies: buildCommentTree(allComments, comment.id, depth + 1),
    }));
}

commentsRoute.get("/posts/:postId/comments", async (c) => {
  const postId = c.req.param("postId");
  const visitorId = c.req.query("visitorId") ?? "";

  const allComments = db
    .select()
    .from(schema.comments)
    .where(eq(schema.comments.postId, postId))
    .all();

  const commentsWithLikes = allComments.map((comment) => {
    const likeCountResult = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.commentLikes)
      .where(eq(schema.commentLikes.commentId, comment.id))
      .get();

    const isLiked = visitorId
      ? db
          .select()
          .from(schema.commentLikes)
          .where(
            and(
              eq(schema.commentLikes.commentId, comment.id),
              eq(schema.commentLikes.visitorId, visitorId),
            ),
          )
          .get()
      : null;

    return { ...comment, likeCount: likeCountResult?.count ?? 0, isLikedByMe: !!isLiked };
  });

  const tree = buildCommentTree(commentsWithLikes);
  return c.json(tree);
});

commentsRoute.post("/posts/:postId/comments", async (c) => {
  const postId = c.req.param("postId");
  const body = await c.req.json<{
    authorName: string;
    authorEmail: string;
    authorUrl?: string;
    authorAvatarUrl?: string;
    commenterId?: string;
    content: string;
    parentId?: string;
  }>();

  // 입력값 sanitize (평문 텍스트만 허용, XSS 방지)
  const authorName = sanitizePlainText(body.authorName ?? "");
  const authorEmail = sanitizePlainText(body.authorEmail ?? "");
  const content = sanitizePlainText(body.content ?? "");
  const authorUrl = body.authorUrl ? sanitizeUrl(body.authorUrl) : null;
  // OAuth 아바타 URL도 검증
  const authorAvatarUrl = body.authorAvatarUrl ? sanitizeUrl(body.authorAvatarUrl) : null;

  if (!body.commenterId) {
    return c.json({ error: "Social login is required to post a comment." }, 403);
  }
  if (!authorName || !content) {
    return c.json({ error: "Name and content are required." }, 400);
  }
  if (content.length > 2000) {
    return c.json({ error: "댓글은 최대 2,000자까지 입력 가능합니다." }, 400);
  }

  if (body.parentId) {
    let depth = 0;
    let currentId: string | null = body.parentId;
    while (currentId) {
      const parent = db
        .select()
        .from(schema.comments)
        .where(eq(schema.comments.id, currentId))
        .get();
      if (!parent) break;
      currentId = parent.parentId;
      depth++;
    }
    if (depth >= 3) {
      return c.json({ error: "대댓글 깊이는 최대 3단계까지 가능합니다." }, 400);
    }
  }

  const post = db.select().from(schema.posts).where(eq(schema.posts.id, postId)).get();
  if (!post || post.status !== "published") {
    return c.json({ error: "게시글을 찾을 수 없습니다." }, 404);
  }

  const now = new Date().toISOString();
  const id = generateId();

  db.insert(schema.comments)
    .values({
      id,
      postId,
      commenterId: body.commenterId ?? null,
      authorName,
      authorEmail,
      authorUrl,
      authorAvatarUrl,
      content,
      parentId: body.parentId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const newComment = db.select().from(schema.comments).where(eq(schema.comments.id, id)).get();
  return c.json(newComment, 201);
});

commentsRoute.post("/comments/:id/like", async (c) => {
  const commentId = c.req.param("id");
  const body = await c.req.json<{ visitorId: string }>();

  if (!body.visitorId) {
    return c.json({ error: "visitorId가 필요합니다." }, 400);
  }

  const existing = db
    .select()
    .from(schema.commentLikes)
    .where(
      and(
        eq(schema.commentLikes.commentId, commentId),
        eq(schema.commentLikes.visitorId, body.visitorId),
      ),
    )
    .get();

  if (existing) {
    db.delete(schema.commentLikes).where(eq(schema.commentLikes.id, existing.id)).run();
    return c.json({ liked: false });
  } else {
    db.insert(schema.commentLikes)
      .values({
        id: generateId(),
        commentId,
        visitorId: body.visitorId,
        createdAt: new Date().toISOString(),
      })
      .run();
    return c.json({ liked: true });
  }
});

commentsRoute.delete("/comments/:id", async (c) => {
  const id = c.req.param("id");
  const comment = db.select().from(schema.comments).where(eq(schema.comments.id, id)).get();
  if (!comment) {
    return c.json({ error: "댓글을 찾을 수 없습니다." }, 404);
  }

  const now = new Date().toISOString();
  db.update(schema.comments)
    .set({ content: "삭제된 댓글입니다.", deletedAt: now, updatedAt: now })
    .where(eq(schema.comments.id, id))
    .run();

  return c.json({ message: "댓글이 삭제되었습니다." });
});

export default commentsRoute;
