import { useState, useCallback } from "react";
import {
  commentApi,
  type CreateCommentPayload,
  type UpdateCommentPayload,
  type DeleteCommentPayload,
} from "@/features/comment/api/commentApi";

export function useCommentMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createComment = useCallback(async (postId: string, payload: CreateCommentPayload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await commentApi.createComment(postId, payload);

      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateComment = useCallback(async (id: string, payload: UpdateCommentPayload) => {
    setLoading(true);
    setError(null);
    try {
      await commentApi.updateComment(id, payload);

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteComment = useCallback(async (id: string, payload?: DeleteCommentPayload) => {
    setLoading(true);
    setError(null);
    try {
      await commentApi.deleteComment(id, payload);

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const likeComment = useCallback(async (id: string, visitorId: string) => {
    setLoading(true);
    setError(null);
    try {
      await commentApi.likeComment(id, visitorId);

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    createComment,
    updateComment,
    deleteComment,
    likeComment,
  };
}
