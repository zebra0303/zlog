/**
 * Simple regex-based Markdown stripper for generating excerpts.
 * Removes HTML tags and common Markdown syntax to produce plain text.
 */
export function stripMarkdown(content: string): string {
  if (!content) return "";

  let text = content;

  // 1. Remove code blocks (```...```) - remove content entirely as code is rarely good summary
  text = text.replace(/```[\s\S]*?```/g, "");

  // 2. Remove HTML tags
  text = text.replace(/<[^>]*>/g, "");

  // 3. Remove images (![alt](url)) -> keep alt text
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");

  // 4. Remove links ([text](url)) -> keep text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 5. Remove headers (# Header)
  text = text.replace(/^#{1,6}\s+/gm, "");

  // 6. Remove blockquotes (> Quote)
  text = text.replace(/^>\s+/gm, "");

  // 7. Remove bold/italic (**text**, __text__, *text*, _text_)
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
  text = text.replace(/(\*|_)(.*?)\1/g, "$2");

  // 8. Remove inline code (`code`)
  text = text.replace(/`([^`]+)`/g, "$1");

  // 9. Remove horizontal rules (---, ***, ___)
  text = text.replace(/^[-*_]{3,}\s*$/gm, "");

  // 10. Remove list markers (- item, 1. item)
  text = text.replace(/^[\s-]*[-+*] \s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");

  // 11. Normalize whitespace (collapse multiple spaces/newlines)
  text = text.replace(/\s+/g, " ");

  return text.trim();
}
