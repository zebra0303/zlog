// Centralized query key factory to eliminate inline key duplication
export const queryKeys = {
  categories: {
    all: ["categories"] as const,
  },
  profile: {
    all: ["profile"] as const,
  },
  posts: {
    all: ["posts"] as const,
    list: (filters: { page: number; category?: string; tag?: string; search?: string }) =>
      ["posts", filters] as const,
    detail: (id: string) => ["post", id] as const,
  },
  tags: {
    all: ["tags"] as const,
  },
  templates: {
    all: ["templates"] as const,
  },
};
