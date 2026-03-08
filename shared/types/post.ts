// ============ Category ============
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  longDescription: string | null;
  coverImage: string | null;
  sortOrder: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryWithStats extends Category {
  postCount: number;
  followerCount: number;
}

// ============ Post ============
export type PostStatus = "draft" | "published" | "deleted";

export interface Post {
  id: string;
  categoryId: string | null;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  coverImageWidth: number | null;
  coverImageHeight: number | null;
  status: PostStatus;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PostWithCategory extends Post {
  category: Pick<Category, "id" | "name" | "slug"> | null;
  tags: Pick<Tag, "id" | "name" | "slug">[];
  commentCount: number;
  likeCount: number;
  isLikedByMe?: boolean;
}

// ============ Tag ============
export interface Tag {
  id: string;
  name: string;
  slug: string;
}
