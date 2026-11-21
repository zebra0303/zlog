import { api } from "@/shared/api/client";
import type { CommentWithReplies } from "@zlog/shared";

export interface CreateCommentPayload {
  authorName: string;
  authorEmail: string;
  authorUrl?: string;
  authorAvatarUrl?: string;
  commenterId?: string;
  content: string;
  parentId?: string;
  password?: string;
}

export interface UpdateCommentPayload {
  content: string;
  commenterId?: string;
  password?: string;
}

export interface DeleteCommentPayload {
  commenterId?: string;
  password?: string;
}

// Paths are relative to ApiClient's `/api` baseUrl (fixes previous `/api/api/...` double prefix)
export const commentApi = {
  fetchComments: async (postId: string, page = 1, visitorId = "") => {
    const params = new URLSearchParams({ page: String(page) });
    if (visitorId) params.set("visitorId", visitorId);
    return api.get<{
      items: CommentWithReplies[];
      total: number;
      page: number;
      perPage: number;
      totalPages: number;
    }>(`/posts/${postId}/comments?${params.toString()}`);
  },

  createComment: async (postId: string, payload: CreateCommentPayload) => {
    return api.post<CommentWithReplies>(`/posts/${postId}/comments`, payload);
  },

  updateComment: async (id: string, payload: UpdateCommentPayload) => {
    return api.put<CommentWithReplies>(`/comments/${id}`, payload);
  },

  deleteComment: async (id: string, payload?: DeleteCommentPayload) => {
    return api.delete<{ message: string }>(`/comments/${id}`, payload);
  },

  likeComment: async (id: string, visitorId: string) => {
    return api.post<{ liked: boolean }>(`/comments/${id}/like`, { visitorId });
  },

  fetchOAuthProviders: async () => {
    return api.get<{ github: boolean; google: boolean }>("/oauth/providers");
  },

  logoutCommenter: async () => {
    return api.post<{ success: boolean }>("/oauth/logout");
  },
};
