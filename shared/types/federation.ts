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
  coverImageWidth: number | null;
  coverImageHeight: number | null;
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
