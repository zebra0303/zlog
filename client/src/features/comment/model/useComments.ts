import { useState, useCallback, useEffect } from "react";
import type { CommentWithReplies } from "@zlog/shared";
import { commentApi } from "@/features/comment/api/commentApi";

interface UseCommentsProps {
  postId: string;
}

export function useComments({ postId }: UseCommentsProps) {
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalComments, setTotalComments] = useState(0);

  const fetchComments = useCallback(
    async (pageToFetch = 1) => {
      setLoading(true);
      setError(null);
      try {
        const res = await commentApi.fetchComments(postId, pageToFetch);
        setComments(res.items);
        setPage(res.page);
        setTotalPages(res.totalPages);
        setTotalComments(res.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    },
    [postId],
  );

  useEffect(() => {
    if (postId) {
      void fetchComments(1);
    }
  }, [postId, fetchComments]);

  const refreshComments = useCallback(() => {
    void fetchComments(page);
  }, [fetchComments, page]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      void fetchComments(newPage);
    },
    [fetchComments],
  );

  return {
    comments,
    loading,
    error,
    page,
    totalPages,
    totalComments,
    handlePageChange,
    refreshComments,
  };
}
