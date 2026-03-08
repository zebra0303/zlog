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

// /auth/me response
export type MeResponse = PublicOwner;

// ============ SocialLink ============
export interface SocialLink {
  id: string;
  platform: string;
  url: string;
  label: string | null;
  sortOrder: number;
}
