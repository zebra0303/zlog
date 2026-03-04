/**
 * Estimate reading time based on content.
 * Korean: ~500 chars/min, English: ~200 words/min.
 */
export function estimateReadingTime(text: string): number {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .trim();
  // Count Korean characters
  const koreanChars = (cleaned.match(/[\u3131-\uD79D]/g) ?? []).length;
  // Count English words (non-Korean text)
  const nonKorean = cleaned.replace(/[\u3131-\uD79D]/g, " ");
  const englishWords = nonKorean.split(/\s+/).filter(Boolean).length;
  const minutes = koreanChars / 500 + englishWords / 200;
  return Math.max(1, Math.round(minutes));
}
