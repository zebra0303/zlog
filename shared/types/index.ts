export { SOCIAL_PLATFORMS, type SocialPlatformKey } from "./socialPlatform.js";

// ============ Owner ============
export interface Owner {
  id: string;
  email: string;
  blogHandle: string;
  siteUrl: string;
  displayName: string;
  bio: string | null;
  aboutMe: string | null;
  jobTitle: string | null;
  company: string | null;
  location: string | null;
  avatarUrl: string | null;
  avatarOriginalName: string | null;
  avatarMimeType: string | null;
  avatarSizeBytes: number | null;
  blogTitle: string | null;
  blogDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PublicOwner = Omit<Owner, "email">;

// ============ SocialLink ============
export interface SocialLink {
  id: string;
  platform: string;
  url: string;
  label: string | null;
  sortOrder: number;
}

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
}

// ============ Tag ============
export interface Tag {
  id: string;
  name: string;
  slug: string;
}

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

// ============ Federation ============
export interface RemoteBlog {
  id: string;
  siteUrl: string;
  displayName: string | null;
  blogTitle: string | null;
  avatarUrl: string | null;
  lastFetchedAt: string | null;
  createdAt: string;
}

export interface RemoteCategory {
  id: string;
  remoteBlogId: string;
  remoteId: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
}

export type RemotePostStatus = "published" | "draft" | "deleted" | "unreachable";

export interface RemotePost {
  id: string;
  remoteUri: string;
  remoteBlogId: string;
  remoteCategoryId: string;
  localCategoryId: string | null;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  remoteStatus: RemotePostStatus;
  authorName: string | null;
  remoteCreatedAt: string;
  remoteUpdatedAt: string;
  fetchedAt: string;
}

export interface CategorySubscription {
  id: string;
  localCategoryId: string;
  remoteCategoryId: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface Subscriber {
  id: string;
  categoryId: string;
  subscriberUrl: string;
  callbackUrl: string;
  isActive: boolean;
  createdAt: string;
}

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

// ============ API types ============
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
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
  blog_title: string;
  seo_description: string;
  seo_og_image: string;
  canonical_url: string;
  webhook_sync_interval: string;
  default_theme: string;
}
