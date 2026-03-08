import { useState, useCallback } from "react";
import { commentApi } from "../api/commentApi";

export function useCommentMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createComment = useCallback(
    async (postId: string, content: string, parentId?: string, password?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await commentApi.createComment(postId, content, parentId, password);

        return res;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const updateComment = useCallback(async (id: string, content: string, password?: string) => {
    setLoading(true);
    setError(null);
    try {
      await commentApi.updateComment(id, content, password);

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteComment = useCallback(async (id: string, password?: string) => {
    setLoading(true);
    setError(null);
    try {
      await commentApi.deleteComment(id, password);

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const likeComment = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await commentApi.likeComment(id);

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
