/**
 * Remote blog URL replacement helper
 *
 * Used on the receiving side: corrects image/resource URLs from remote blogs
 * that use relative paths or incorrect domains (e.g., localhost)
 * to the actual remote blog URL.
 */

/** Replace the domain of a single URL with the actual remote blog URL */
export function fixRemoteUrl(url: string | null, remoteSiteUrl: string): string | null {
  if (!url) return url;
  if (url.startsWith("/")) return remoteSiteUrl + url;
  return url.replace(/^https?:\/\/[^/]+(\/(uploads|img)\/)/, `${remoteSiteUrl}$1`);
}

/**
 * Replace image URL domains in content with the actual remote blog URL
 * - Relative paths: /uploads/... -> remoteSiteUrl/uploads/...
 * - Wrong domains: http://localhost/uploads/... -> remoteSiteUrl/uploads/...
 * - Handles both Markdown ![...](...) and HTML <img src="...">
 */
export function fixRemoteContentUrls(content: string, remoteSiteUrl: string): string {
  let fixed = content;
  fixed = fixed.replace(/(!\[.*?\]\()(\/\/(uploads|img)\/[^)]+\))/g, `$1${remoteSiteUrl}$2`);
  fixed = fixed.replace(
    /(!\[.*?\]\()https?:\/\/[^/\s"')]+(\/(uploads|img)\/[^)]+\))/g,
    `$1${remoteSiteUrl}$2`,
  );
  fixed = fixed.replace(/(src=["'])(\/(uploads|img)\/)/g, `$1${remoteSiteUrl}$2`);
  fixed = fixed.replace(
    /(src=["'])https?:\/\/[^/\s"']+(\/(uploads|img)\/)/g,
    `$1${remoteSiteUrl}$2`,
  );
  return fixed;
}
