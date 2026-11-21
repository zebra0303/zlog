import DOMPurify from "dompurify";

const ALLOWED_IFRAME_PREFIXES = [
  "https://www.youtube-nocookie.com/embed/",
  "https://codepen.io/",
  "https://codesandbox.io/embed/",
];

const DANGEROUS_STYLE_PATTERN = /(?:expression\s*\(|url\s*\(|@import|javascript:|behavior\s*:)/i;

let hooksRegistered = false;

function ensureSanitizeHooks() {
  if (hooksRegistered || typeof window === "undefined") return;
  hooksRegistered = true;

  // Enforce strict iframe origin allowlist to block arbitrary embedded pages or phishing frames
  DOMPurify.addHook("uponSanitizeElement", (node, data) => {
    if (data.tagName === "iframe" && node instanceof Element) {
      const src = node.getAttribute("src") ?? "";
      const isAllowed = ALLOWED_IFRAME_PREFIXES.some((prefix) => src.startsWith(prefix));
      if (!isAllowed) {
        node.remove();
      }
    }
  });

  // Strip dangerous CSS constructs from inline style attributes
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName === "style" && DANGEROUS_STYLE_PATTERN.test(data.attrValue)) {
      data.keepAttr = false;
    }
  });
}

/**
 * Sanitizes an HTML string to prevent XSS attacks.
 * Should be used before ANY dangerouslySetInnerHTML assignment.
 *
 * @param html The dirty HTML string
 * @returns The sanitized, safe HTML string
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") {
    return html;
  }

  ensureSanitizeHooks();

  return DOMPurify.sanitize(html, {
    // Keep target="_blank" and safe embed/markdown attributes
    ADD_ATTR: [
      "target",
      "rel",
      "class",
      "style",
      "aria-hidden",
      "tabindex",
      "allow",
      "allowfullscreen",
      "frameborder",
      "sandbox",
    ],
    // Allow iframes strictly filtered to trusted embed origins via hook above
    ADD_TAGS: ["iframe"],
  });
}
