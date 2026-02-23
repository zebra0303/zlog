import { z } from "zod";

const RemoteBlogSchema = z.object({
  id: z.string().optional(),
  siteUrl: z.string(),
  displayName: z.string().nullable(),
  blogTitle: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

const PostSchema = z.object({
  id: z.string(),
  categoryId: z.string().nullable(),
  title: z.string(),
  slug: z.string(),
  content: z.string(),
  excerpt: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  status: z.enum(["draft", "published", "deleted"]),
  viewCount: z.number().default(0),
  commentCount: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
  category: z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
    })
    .nullable(),
  tags: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
    }),
  ),
  isRemote: z.boolean().default(false),
  remoteUri: z.string().nullable().optional(),
  remoteBlog: RemoteBlogSchema.nullable().optional(),
});

export const PostListResponseSchema = z.object({
  items: z.array(PostSchema),
  total: z.number(),
  page: z.number(),
  perPage: z.number(),
  totalPages: z.number(),
});

export const PostDetailSchema = PostSchema;

export const CreatePostSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  categoryId: z.string().optional(),
  status: z.enum(["draft", "published"]).optional(),
  tags: z.array(z.string()).optional(),
  coverImage: z.string().optional(),
  excerpt: z.string().optional(),
});

export const UpdatePostSchema = CreatePostSchema.partial();
