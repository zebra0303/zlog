import { api } from "@/shared/api/client";
import type { CommentWithReplies } from "@zlog/shared";

export const commentApi = {
  fetchComments: async (postId: string, page = 1, limit = 20) => {
    return api.get<{
      items: CommentWithReplies[];
      total: number;
      page: number;
      perPage: number;
      totalPages: number;
    }>(`/api/comments/${postId}?page=${page}&limit=${limit}`);
  },

  createComment: async (postId: string, content: string, parentId?: string, password?: string) => {
    return api.post<{ comment: CommentWithReplies }>(`/api/comments/${postId}`, {
      content,
      parentId,
      password,
    });
  },

  updateComment: async (id: string, content: string, password?: string) => {
    return api.put<{ success: boolean }>(`/api/comments/${id}`, {
      content,
      password,
    });
  },

  deleteComment: async (id: string, password?: string) => {
    return api.delete<{ success: boolean }>(`/api/comments/${id}`, {
      password,
    });
  },

  likeComment: async (id: string) => {
    return api.post<{ success: boolean }>(`/api/comments/${id}/like`);
  },

  fetchOAuthProviders: async () => {
    return api.get<{ id: string; name: string }[]>("/api/oauth/providers");
  },
};
