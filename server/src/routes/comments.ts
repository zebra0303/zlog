import { Hono } from "hono";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { generateId } from "../lib/uuid.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { verifyToken } from "../middleware/auth.js";

const commentsRoute = new Hono();

/**
 * HTML 태그 및 XSS 위험 요소 제거 — 평문 텍스트만 허용
 */
function sanitizePlainText(input: string): string {
  return (
    input
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
      .trim()
  );
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

/** comment_mode 설정 조회 */
function getCommentMode(): string {
  const setting = db
    .select()
    .from(schema.siteSettings)
    .where(eq(schema.siteSettings.key, "comment_mode"))
    .get();
  return setting?.value ?? "sso_only";
}

/** JWT 토큰에서 관리자 여부 확인 (optional) */
async function isAdmin(c: {
  req: { header: (name: string) => string | undefined };
}): Promise<boolean> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  const ownerId = await verifyToken(token);
  return !!ownerId;
}

/** password 필드를 제외하고 hasPassword 플래그를 추가 */
function stripPassword(comment: typeof schema.comments.$inferSelect) {
  const { password, ...rest } = comment;
  return { ...rest, hasPassword: !!password };
}

function buildCommentTree(
  allComments: (ReturnType<typeof stripPassword> & {
    likeCount: number;
    isLikedByMe: boolean;
  })[],
  parentId: string | null = null,
  depth = 0,
): (ReturnType<typeof stripPassword> & {
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

// ==================== GET 댓글 목록 ====================
commentsRoute.get("/posts/:postId/comments", (c) => {
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

    return {
      ...stripPassword(comment),
      likeCount: likeCountResult?.count ?? 0,
      isLikedByMe: !!isLiked,
    };
  });

  const tree = buildCommentTree(commentsWithLikes);
  return c.json(tree);
});

// ==================== POST 댓글 작성 ====================
commentsRoute.post("/posts/:postId/comments", async (c) => {
  const postId = c.req.param("postId");
  const body = await c.req.json<{
    authorName: string;
    authorEmail: string;
    authorUrl?: string;
    authorAvatarUrl?: string;
    commenterId?: string;
    password?: string;
    content: string;
    parentId?: string;
  }>();

  // 입력값 sanitize (평문 텍스트만 허용, XSS 방지)
  const authorName = sanitizePlainText(body.authorName);
  const authorEmail = sanitizePlainText(body.authorEmail);
  const content = sanitizePlainText(body.content);
  const authorUrl = body.authorUrl ? sanitizeUrl(body.authorUrl) : null;
  const authorAvatarUrl = body.authorAvatarUrl ? sanitizeUrl(body.authorAvatarUrl) : null;

  const commentMode = getCommentMode();

  if (commentMode === "disabled") {
    return c.json({ error: "Comments are disabled." }, 403);
  }

  if (commentMode === "sso_only" && !body.commenterId) {
    return c.json({ error: "Social login is required to post a comment." }, 403);
  }

  if (commentMode === "anonymous_only" && body.commenterId) {
    // anonymous_only 모드에서는 SSO 댓글 비허용 (무시하고 익명 처리)
    // body.commenterId를 무시
  }

  // 익명 댓글(commenterId 없음)에는 비밀번호 필수
  const isAnonymous = !body.commenterId || commentMode === "anonymous_only";
  if (isAnonymous && !body.password) {
    return c.json({ error: "Password is required for anonymous comments." }, 400);
  }

  if (!authorName || !content) {
    return c.json({ error: "Name and content are required." }, 400);
  }
  if (content.length > 2000) {
    return c.json({ error: "Comment must be 2,000 characters or less." }, 400);
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
      return c.json({ error: "Maximum reply depth (3) reached." }, 400);
    }
  }

  const post = db.select().from(schema.posts).where(eq(schema.posts.id, postId)).get();
  if (post?.status !== "published") {
    return c.json({ error: "Post not found." }, 404);
  }

  const now = new Date().toISOString();
  const id = generateId();
  const passwordHash = isAnonymous && body.password ? hashPassword(body.password) : null;

  db.insert(schema.comments)
    .values({
      id,
      postId,
      commenterId: isAnonymous ? null : (body.commenterId ?? null),
      authorName,
      authorEmail,
      authorUrl,
      authorAvatarUrl,
      content,
      password: passwordHash,
      parentId: body.parentId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const newComment = db.select().from(schema.comments).where(eq(schema.comments.id, id)).get();
  return c.json(newComment ? stripPassword(newComment) : null, 201);
});

// ==================== PUT 댓글 수정 ====================
commentsRoute.put("/comments/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    content: string;
    commenterId?: string;
    password?: string;
  }>();

  const comment = db.select().from(schema.comments).where(eq(schema.comments.id, id)).get();
  if (!comment || comment.deletedAt) {
    return c.json({ error: "Comment not found." }, 404);
  }

  const content = sanitizePlainText(body.content);
  if (!content) {
    return c.json({ error: "Content is required." }, 400);
  }
  if (content.length > 2000) {
    return c.json({ error: "Comment must be 2,000 characters or less." }, 400);
  }

  // 권한 확인: SSO 댓글 → commenterId 일치, 익명 댓글 → password 일치
  if (comment.commenterId) {
    // SSO 댓글
    if (!body.commenterId || body.commenterId !== comment.commenterId) {
      return c.json({ error: "You can only edit your own comment." }, 403);
    }
  } else {
    // 익명 댓글
    if (!body.password || !comment.password) {
      return c.json({ error: "Password is required to edit this comment." }, 403);
    }
    if (!verifyPassword(body.password, comment.password)) {
      return c.json({ error: "Incorrect password." }, 403);
    }
  }

  const now = new Date().toISOString();
  db.update(schema.comments)
    .set({ content, isEdited: true, updatedAt: now })
    .where(eq(schema.comments.id, id))
    .run();

  const updated = db.select().from(schema.comments).where(eq(schema.comments.id, id)).get();
  return c.json(updated ? stripPassword(updated) : null);
});

// ==================== DELETE 댓글 삭제 ====================
commentsRoute.delete("/comments/:id", async (c) => {
  const id = c.req.param("id");
  const comment = db.select().from(schema.comments).where(eq(schema.comments.id, id)).get();
  if (!comment) {
    return c.json({ error: "Comment not found." }, 404);
  }

  // 관리자 체크 (JWT 토큰)
  const admin = await isAdmin(c);
  if (admin) {
    // 관리자는 무조건 삭제 가능
    const now = new Date().toISOString();
    db.update(schema.comments)
      .set({ content: "Deleted comment.", deletedAt: now, updatedAt: now })
      .where(eq(schema.comments.id, id))
      .run();
    return c.json({ message: "Comment deleted." });
  }

  // 본인 확인
  let body: { commenterId?: string; password?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    // body 없이 요청한 경우
  }

  if (comment.commenterId) {
    // SSO 댓글: commenterId 확인
    if (!body.commenterId || body.commenterId !== comment.commenterId) {
      return c.json({ error: "You can only delete your own comment." }, 403);
    }
  } else {
    // 익명 댓글: 비밀번호 확인
    if (!body.password || !comment.password) {
      return c.json({ error: "Password is required to delete this comment." }, 403);
    }
    if (!verifyPassword(body.password, comment.password)) {
      return c.json({ error: "Incorrect password." }, 403);
    }
  }

  const now = new Date().toISOString();
  db.update(schema.comments)
    .set({ content: "Deleted comment.", deletedAt: now, updatedAt: now })
    .where(eq(schema.comments.id, id))
    .run();

  return c.json({ message: "Comment deleted." });
});

// ==================== POST 좋아요 ====================
commentsRoute.post("/comments/:id/like", async (c) => {
  const commentId = c.req.param("id");
  const body = await c.req.json<{ visitorId: string }>();

  if (!body.visitorId) {
    return c.json({ error: "visitorId is required." }, 400);
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

export default commentsRoute;
