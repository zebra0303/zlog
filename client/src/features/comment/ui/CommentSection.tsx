import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Heart, Reply } from "lucide-react";
import { Button, Card, CardContent, Input, Textarea, DefaultAvatar } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { timeAgo } from "@/shared/lib/formatDate";
import type { CommentWithReplies, CreateCommentRequest } from "@zlog/shared";

function getVisitorId(): string {
  let id = localStorage.getItem("zlog_visitor_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("zlog_visitor_id", id); }
  return id;
}

export function CommentSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchComments = useCallback(() => {
    void api.get<CommentWithReplies[]>(`/posts/${postId}/comments?visitorId=${getVisitorId()}`).then((data) => { setComments(data); setIsLoading(false); }).catch(() => setIsLoading(false));
  }, [postId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  return (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]"><MessageSquare className="h-5 w-5" />댓글</h3>
      <CommentForm postId={postId} onSuccess={fetchComments} />
      <div className="mt-6 flex flex-col gap-4">{comments.map((c) => <CommentThread key={c.id} comment={c} postId={postId} onRefresh={fetchComments} depth={0} />)}</div>
      {!isLoading && comments.length === 0 && <p className="mt-4 text-center text-sm text-[var(--color-text-secondary)]">아직 댓글이 없습니다.</p>}
    </div>
  );
}

function CommentForm({ postId, parentId, onSuccess, onCancel }: { postId: string; parentId?: string; onSuccess: () => void; onCancel?: () => void }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false); const [error, setError] = useState<string | null>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); setError(null);
    try { await api.post(`/posts/${postId}/comments`, { authorName: name, authorEmail: email, content, parentId } satisfies CreateCommentRequest); setContent(""); onSuccess(); }
    catch (err) { setError(err instanceof Error ? err.message : "댓글 작성에 실패했습니다."); } finally { setIsSubmitting(false); }
  };
  return (
    <Card><CardContent className="pt-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex gap-3"><Input placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} required className="flex-1" /><Input placeholder="이메일" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="flex-1" /></div>
        <Textarea placeholder="댓글을 입력하세요..." value={content} onChange={(e) => setContent(e.target.value)} required maxLength={2000} rows={3} />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">{onCancel && <Button variant="ghost" size="sm" type="button" onClick={onCancel}>취소</Button>}<Button size="sm" type="submit" disabled={isSubmitting}>{isSubmitting ? "작성 중..." : "댓글 작성"}</Button></div>
      </form>
    </CardContent></Card>
  );
}

function CommentThread({ comment, postId, onRefresh, depth }: { comment: CommentWithReplies; postId: string; onRefresh: () => void; depth: number }) {
  const [showReply, setShowReply] = useState(false);
  const isDeleted = !!comment.deletedAt;
  const handleLike = async () => { try { await api.post(`/comments/${comment.id}/like`, { visitorId: getVisitorId() }); onRefresh(); } catch {} };
  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-[var(--color-border)] pl-4" : ""}>
      <div className="flex gap-3">
        <DefaultAvatar size={36} />
        <div className="flex-1">
          <div className="flex items-center gap-2"><span className="font-medium text-[var(--color-text)]">{isDeleted ? "삭제됨" : comment.authorName}</span><span className="text-xs text-[var(--color-text-secondary)]">{timeAgo(comment.createdAt)}</span></div>
          <p className={`mt-1 text-sm ${isDeleted ? "italic text-[var(--color-text-secondary)]" : "text-[var(--color-text)]"}`}>{comment.content}</p>
          {!isDeleted && (
            <div className="mt-2 flex items-center gap-3">
              <button onClick={handleLike} className={`flex items-center gap-1 text-xs transition-colors ${comment.isLikedByMe ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"}`}><Heart className={`h-3.5 w-3.5 ${comment.isLikedByMe ? "fill-current" : ""}`} />{comment.likeCount > 0 && comment.likeCount}</button>
              {depth < 2 && <button onClick={() => setShowReply(!showReply)} className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"><Reply className="h-3.5 w-3.5" />답글</button>}
            </div>
          )}
          {showReply && <div className="mt-3"><CommentForm postId={postId} parentId={comment.id} onSuccess={() => { setShowReply(false); onRefresh(); }} onCancel={() => setShowReply(false)} /></div>}
        </div>
      </div>
      {comment.replies.length > 0 && <div className="mt-3 flex flex-col gap-3">{comment.replies.map((r) => <CommentThread key={r.id} comment={r} postId={postId} onRefresh={onRefresh} depth={depth + 1} />)}</div>}
    </div>
  );
}
