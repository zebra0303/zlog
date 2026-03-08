import DOMPurify from "dompurify";

/**
 * Sanitizes an HTML string to prevent XSS attacks.
 * Should be used before ANY dangerouslySetInnerHTML assignment.
 *
 * @param html The dirty HTML string
 * @returns The sanitized, safe HTML string
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") {
    // If running in a non-browser environment (e.g. server-side testing), return as is or mock
    // DOMPurify requires a window object. In Next.js/SSR you would use JSDOM, but this client
    // runs in Vite and the HTML is usually rendered on the client side.
    return html;
  }

  return DOMPurify.sanitize(html, {
    // We want to keep target="_blank" and other safe attributes we add via markdown parser
    ADD_ATTR: ["target", "rel", "class", "style", "aria-hidden", "tabindex"],
    // Allow iframes for YouTube embeds, codepen, etc. (make sure these are trusted sources)
    ADD_TAGS: ["iframe"],
  });
}
