// ============ Comment ============
export interface Comment {
  id: string;
  postId: string;
  commenterId: string | null;
  authorName: string;
  authorEmail: string;
  authorUrl: string | null;
  authorAvatarUrl: string | null;
  content: string;
  hasPassword: boolean;
  parentId: string | null;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CommentWithReplies extends Comment {
  likeCount: number;
  isLikedByMe: boolean;
  replies: CommentWithReplies[];
}
