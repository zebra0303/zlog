import {
  createSlug as baseCreateSlug,
  createUniqueSlug as baseCreateUniqueSlug,
} from "@zebra/core";

// Wrap with zlog-specific "post" fallback
export function createSlug(text: string): string {
  return baseCreateSlug(text, "post");
}

export function createUniqueSlug(text: string, existingSlugs: string[]): string {
  return baseCreateUniqueSlug(text, existingSlugs);
}
