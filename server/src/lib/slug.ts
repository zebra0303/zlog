export function createSlug(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ-]/g, "") // Include Hangul consonants and vowels
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "post"; // Fallback if the title is empty or only special characters
}

export function createUniqueSlug(text: string, existingSlugs: string[]): string {
  const base = createSlug(text);
  if (!existingSlugs.includes(base)) return base;

  let counter = 2;
  while (existingSlugs.includes(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}
