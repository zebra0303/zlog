import type { PublicOwner, SocialLink } from "./user.js";
import type { PostStatus } from "./post.js";

// ============ SiteSettings ============
export interface SiteSetting {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

// ============ PostAccessLog ============
export interface PostAccessLog {
  id: string;
  postId: string;
  ip: string | null;
  country: string | null;
  referer: string | null;
  userAgent: string | null;
  os: string | null;
  browser: string | null;
  createdAt: string;
}

// ============ PostTemplate ============
export interface PostTemplate {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// ============ API types ============
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  owner: PublicOwner;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface CreatePostRequest {
  title: string;
  content: string;
  categoryId?: string;
  status?: PostStatus;
  tags?: string[];
  coverImage?: string | null;
  excerpt?: string;
}

export interface UpdatePostRequest extends Partial<CreatePostRequest> {
  id?: string;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  longDescription?: string;
  coverImage?: string;
  isPublic?: boolean;
}

export interface UpdateCategoryRequest extends Partial<CreateCategoryRequest> {
  sortOrder?: number;
}

export interface CreateCommentRequest {
  authorName: string;
  authorEmail: string;
  authorUrl?: string;
  content: string;
  parentId?: string;
}

export interface FederationInfo {
  siteUrl: string;
  displayName: string;
  blogTitle: string | null;
  blogDescription: string | null;
  avatarUrl: string | null;
  blogHandle: string;
}

export interface WebhookEvent {
  event: "post.published" | "post.updated" | "post.deleted" | "post.unpublished";
  post: {
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt: string | null;
    coverImage: string | null;
    coverImageWidth: number | null;
    coverImageHeight: number | null;
    createdAt: string;
    updatedAt: string;
  };
  categoryId: string;
  siteUrl: string;
}

export interface SubscribeRequest {
  categoryId: string;
  subscriberUrl: string;
  callbackUrl: string;
}

export interface UnsubscribeRequest {
  categoryId: string;
  subscriberUrl: string;
}

export interface ProfileWithStats extends PublicOwner {
  socialLinks: SocialLink[];
  stats: {
    totalPosts: number;
    totalCategories: number;
    totalViews: number;
  };
}

export interface UpdateProfileRequest {
  displayName?: string;
  bio?: string;
  aboutMe?: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  blogTitle?: string;
  blogDescription?: string;
}

export interface UpdateSocialLinksRequest {
  links: {
    platform: string;
    url: string;
    label?: string;
    sortOrder?: number;
  }[];
}

export interface SiteSettingsMap {
  posts_per_page: string;
  lazy_load_images: string;
  comments_per_page: string;
  blog_title: string;
  seo_description: string;
  seo_og_image: string;
  canonical_url: string;
  webhook_sync_interval: string;
  default_theme: string;
  notification_slack_webhook: string;
}
