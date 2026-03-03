// Shared react-query hooks to deduplicate network requests across components
import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import { queryKeys } from "./queryKeys";
import type { CategoryWithStats, ProfileWithStats } from "@zlog/shared";

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => api.get<CategoryWithStats[]>("/categories"),
  });
}

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile.all,
    queryFn: () => api.get<ProfileWithStats>("/profile"),
  });
}
