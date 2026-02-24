import { Hono } from "hono";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql, inArray } from "drizzle-orm";
import { generateId } from "../lib/uuid.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { verifyToken } from "../middleware/auth.js";
import { getT } from "../lib/i18n/index.js";

const commentsRoute = new Hono();

/**
 * Strip HTML tags and XSS risk elements — allow plain text only
 */
function sanitizePlainText(input: string): string {
  return (
    input
      // Replace dangerous characters not encoded as HTML entities
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .trim()
  );
}

/**
 * URL validation — allow http/https only
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

/** Get comment_mode setting */
function getCommentMode(): string {
  const setting = db
    .select()
    .from(schema.siteSettings)
    .where(eq(schema.siteSettings.key, "comment_mode"))
    .get();
  return setting?.value ?? "sso_only";
}

function getSlackWebhook(): string {
  return (
    db
      .select()
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.key, "notification_slack_webhook"))
      .get()?.value ?? ""
  );
}

function getDefaultLanguage(): string {
  return (
    db
      .select()
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.key, "default_language"))
      .get()?.value ?? "ko"
  );
}

async function sendSlackNotification(
  webhookUrl: string,
  post: { title: string; slug: string },
  comment: { authorName: string; content: string; parentId: string | null },
): Promise<void> {
  const lang = getDefaultLanguage();
  const t = getT(lang);

  const canonicalUrl =
    db.select().from(schema.siteSettings).where(eq(schema.siteSettings.key, "canonical_url")).get()
      ?.value ?? "";
  const postUrl = canonicalUrl ? `${canonicalUrl}/posts/${post.slug}` : "";

  const typeKey = comment.parentId ? "slack_new_reply" : "slack_new_comment";
  const preview =
    comment.content.length > 200 ? comment.content.slice(0, 200) + "…" : comment.content;

  const lines = [
    t(typeKey),
    t("slack_post", { title: post.title }),
    t("slack_author", { authorName: comment.authorName }),
    t("slack_content", { content: preview }),
    postUrl ? `🔗 ${postUrl}` : "",
  ].filter(Boolean);

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: lines.join("\n") }),
  });
}

/** Check if the user is an admin from JWT token (optional) */
async function isAdmin(c: {
  req: { header: (name: string) => string | undefined };
}): Promise<boolean> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  const ownerId = await verifyToken(token);
  return !!ownerId;
}

/** Exclude password field and add hasPassword flag */
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

// ==================== GET comment list ====================
commentsRoute.get("/posts/:postId/comments", (c) => {
  const postId = c.req.param("postId");
  const visitorId = c.req.query("visitorId") ?? "";

  const allComments = db
    .select()
    .from(schema.comments)
    .where(eq(schema.comments.postId, postId))
    .all();

  const commentIds = allComments.map((c) => c.id);

  // Batch: like counts (single query)
  const likeCountMap = new Map<string, number>();
  if (commentIds.length > 0) {
    const rows = db
      .select({
        commentId: schema.commentLikes.commentId,
        count: sql<number>`count(*)`,
      })
      .from(schema.commentLikes)
      .where(inArray(schema.commentLikes.commentId, commentIds))
      .groupBy(schema.commentLikes.commentId)
      .all();
    for (const r of rows) likeCountMap.set(r.commentId, r.count);
  }

  // Batch: visitor's likes (single query)
  const myLikeSet = new Set<string>();
  if (visitorId && commentIds.length > 0) {
    const rows = db
      .select({ commentId: schema.commentLikes.commentId })
      .from(schema.commentLikes)
      .where(
        and(
          inArray(schema.commentLikes.commentId, commentIds),
          eq(schema.commentLikes.visitorId, visitorId),
        ),
      )
      .all();
    for (const r of rows) myLikeSet.add(r.commentId);
  }

  const commentsWithLikes = allComments.map((comment) => ({
    ...stripPassword(comment),
    likeCount: likeCountMap.get(comment.id) ?? 0,
    isLikedByMe: myLikeSet.has(comment.id),
  }));

  const tree = buildCommentTree(commentsWithLikes);
  return c.json(tree);
});

// ==================== POST create comment ====================
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

  // Sanitize input (allow plain text only, prevent XSS)
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
    // In anonymous_only mode, SSO comments are not allowed (ignore and treat as anonymous)
    // Ignore body.commenterId
  }

  // Password is required for anonymous comments (no commenterId)
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

  // Fire-and-forget Slack notification (post is already fetched above)
  const webhookUrl = getSlackWebhook();
  if (webhookUrl) {
    void sendSlackNotification(webhookUrl, post, {
      authorName,
      content,
      parentId: body.parentId ?? null,
    }).catch(() => null);
  }

  const newComment = db.select().from(schema.comments).where(eq(schema.comments.id, id)).get();
  return c.json(newComment ? stripPassword(newComment) : null, 201);
});

// ==================== PUT update comment ====================
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

  // Authorization check: SSO comment → match commenterId, anonymous comment → match password
  if (comment.commenterId) {
    // SSO comment
    if (!body.commenterId || body.commenterId !== comment.commenterId) {
      return c.json({ error: "You can only edit your own comment." }, 403);
    }
  } else {
    // Anonymous comment
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

// ==================== DELETE comment ====================
commentsRoute.delete("/comments/:id", async (c) => {
  const id = c.req.param("id");
  const comment = db.select().from(schema.comments).where(eq(schema.comments.id, id)).get();
  if (!comment) {
    return c.json({ error: "Comment not found." }, 404);
  }

  // Admin check (JWT token)
  const admin = await isAdmin(c);
  if (admin) {
    // Admin can always delete
    const now = new Date().toISOString();
    db.update(schema.comments)
      .set({ content: "Deleted comment.", deletedAt: now, updatedAt: now })
      .where(eq(schema.comments.id, id))
      .run();
    return c.json({ message: "Comment deleted." });
  }

  // Verify ownership
  let body: { commenterId?: string; password?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    // Request sent without body
  }

  if (comment.commenterId) {
    // SSO comment: verify commenterId
    if (!body.commenterId || body.commenterId !== comment.commenterId) {
      return c.json({ error: "You can only delete your own comment." }, 403);
    }
  } else {
    // Anonymous comment: verify password
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

// ==================== POST like ====================
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
